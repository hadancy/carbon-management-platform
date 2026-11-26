"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Form } from "antd";
import { createUuid } from "@/lib/uuid";
import {
  diagnostic,
  type CalculationDiagnostic,
} from "@/domain/calculation/pv-contract";
import { adminRequest } from "@/components/admin/api";
import { useUnsavedChangesWarning } from "@/components/backend/use-unsaved-changes-warning";
import type { AccountingFormValues, CaseView, RunView } from "./types";

export function useAccountingActions(
  entry: CaseView,
  canWrite: boolean,
  canReview: boolean,
  currentUserId: string,
  onInvalidField: (name: (string | number)[]) => void,
  getProductionIssues: (
    values: AccountingFormValues,
  ) => CalculationDiagnostic[],
) {
  const router = useRouter();
  const { message } = App.useApp();
  const revision = entry.revisions.find(
    (item) => item.id === entry.currentRevisionId,
  )!;
  const [form] = Form.useForm<AccountingFormValues>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CalculationDiagnostic[]>([]);
  const [productionErrors, setProductionErrors] = useState<
    CalculationDiagnostic[]
  >([]);
  const [productionCheckOpen, setProductionCheckOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    revision.runs[0]?.id ?? null,
  );
  const editable = canWrite && revision.status === "DRAFT";
  const reviewable =
    canReview &&
    revision.status === "SUBMITTED" &&
    ![
      revision.createdById,
      revision.lastEditedById,
      revision.submittedById,
    ].includes(currentUserId);
  const viewedRevision = entry.revisions.find((item) =>
    item.runs.some((run) => run.id === selectedRunId),
  );
  const viewedRun =
    viewedRevision?.runs.find((run) => run.id === selectedRunId) ?? null;
  const productionRun = revision.runs.find(
    (run) =>
      run.mode === "PRODUCTION" && run.inputRevision === revision.inputRevision,
  );
  useUnsavedChangesWarning(editable && dirty);
  function markDirty() {
    setDirty(true);
    setProductionErrors((previous) => (previous.length ? [] : previous));
  }
  async function productionFieldErrors() {
    try {
      await form.validateFields({ validateOnly: true });
      return [];
    } catch (error) {
      const fields = (
        error as {
          errorFields?: { name: (string | number)[]; errors: string[] }[];
        }
      ).errorFields;
      return fields?.length
        ? fields.map(({ name, errors }) =>
            diagnostic(
              name.join("."),
              "PRODUCTION",
              "FORM_FIELD",
              errors.join("；"),
              "",
            ),
          )
        : [
            diagnostic(
              "form",
              "PRODUCTION",
              "FORM_FIELD",
              "输入已变化，请重新检查",
              "",
            ),
          ];
    }
  }
  async function openProductionCheck() {
    setProductionCheckOpen(true);
    const fields = await productionFieldErrors();
    setProductionErrors((previous) => [
      ...previous.filter((issue) => issue.code !== "FORM_FIELD"),
      ...fields,
    ]);
  }
  async function complete() {
    try {
      await form.validateFields();
      return true;
    } catch (error) {
      const first = (error as { errorFields?: { name: (string | number)[] }[] })
        .errorFields?.[0]?.name;
      if (first) onInvalidField(first);
      message.warning("请先修正页面标记的数据项");
      return false;
    }
  }
  async function save() {
    if (!editable || busy) return;
    setBusy(true);
    try {
      const { ruleVersionId, ...inputs } = form.getFieldsValue(true);
      await adminRequest(`/api/accounting/cases/${entry.id}`, "PATCH", {
        expectedInputRevision: revision.inputRevision,
        ruleVersionId: ruleVersionId ?? null,
        inputs,
      });
      message.success("草稿已保存，请对当前输入重新计算");
      setDirty(false);
      setDiagnostics([]);
      setProductionErrors([]);
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function calculate(mode: "TRIAL" | "PRODUCTION") {
    if (busy || !editable) return;
    if (mode === "PRODUCTION") {
      const fields = await productionFieldErrors();
      if (
        fields.length ||
        getProductionIssues(form.getFieldsValue(true)).length
      ) {
        setProductionErrors(fields);
        setProductionCheckOpen(true);
        return;
      }
    }
    if (dirty) {
      message.warning("请先保存输入，再计算");
      return;
    }
    if (mode === "TRIAL" && !(await complete())) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/accounting/cases/${entry.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: createUuid(), mode }),
      });
      const data = (await response.json()) as {
        run: RunView | null;
        diagnostics: CalculationDiagnostic[];
        error?: string;
      };
      if (Array.isArray(data.diagnostics) && data.diagnostics.length) {
        if (mode === "PRODUCTION") {
          setProductionErrors(data.diagnostics);
          setProductionCheckOpen(true);
        } else {
          setDiagnostics(data.diagnostics);
          message.warning("请修正计算诊断中的数据");
        }
        return;
      }
      if (!response.ok || !data.run) throw Error(data.error || "计算失败");
      setDiagnostics([]);
      setProductionErrors([]);
      setSelectedRunId(data.run.id);
      message.success(mode === "TRIAL" ? "试算完成" : "正式计算完成");
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "计算失败");
    } finally {
      setBusy(false);
    }
  }
  async function transition(
    kind: "submit" | "revise" | "review",
    decision?: "APPROVE" | "REJECT",
    reason = "",
  ) {
    if (busy) return false;
    if (kind === "submit" && (dirty || !(await complete()))) return false;
    setBusy(true);
    try {
      if (kind === "submit") {
        if (!productionRun) throw Error("请先对当前输入完成正式计算");
        await adminRequest(`/api/accounting/cases/${entry.id}/submit`, "POST", {
          runId: productionRun.id,
          expectedInputRevision: revision.inputRevision,
        });
        message.success("已提交审核");
      } else if (kind === "revise") {
        await adminRequest(
          `/api/accounting/cases/${entry.id}/revisions`,
          "POST",
          {},
        );
        message.success("新草稿修订已创建");
      } else {
        await adminRequest(`/api/accounting/cases/${entry.id}/review`, "POST", {
          decision,
          reason,
        });
        message.success(decision === "APPROVE" ? "审核通过" : "已驳回");
      }
      router.refresh();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    form,
    revision,
    dirty,
    markDirty,
    busy,
    diagnostics,
    productionErrors,
    productionCheckOpen,
    openProductionCheck,
    closeProductionCheck: () => setProductionCheckOpen(false),
    selectedRunId,
    setSelectedRunId,
    viewedRevision,
    viewedRun,
    editable,
    reviewable,
    productionRun,
    save,
    calculate,
    transition,
  };
}
