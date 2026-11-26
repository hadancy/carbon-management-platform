"use client";
import { formatBeijingTime } from "@/shared/beijing-time";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, Card, Form, Select, Space, Tabs, Tag, Typography } from "antd";
import { ACCOUNTING_STATUS_LABELS } from "@/shared/accounting";
import { modelRows, type ModelRow } from "@/domain/calculation/model-rows";
import { productionReadiness } from "@/domain/calculation/production-readiness";
import type { CalculationDiagnostic } from "@/domain/calculation/pv-contract";
import type {
  AccountingFormValues,
  CaseView,
  FactorOption,
  RevisionView,
  RuleOption,
} from "./types";
import { ActivityLines } from "./activity-lines";
import {
  AnnualEnergyEditor,
  type AnnualEnergyEditRequest,
} from "./annual-energy";
import { CaseMethodForm } from "./case-method-form";
import { RunResults } from "./run-results";
import { useAccountingActions } from "./use-accounting-actions";
import { AccountingToolbar } from "./accounting-toolbar";
import { AccountingReviewDialog } from "./accounting-review-dialog";
import { AccountingHistory } from "./accounting-history";
import { EvidenceLibrary } from "./evidence-library";
import {
  AccountingDiagnostics,
  accountingIssueTarget,
  accountingSection,
} from "./accounting-diagnostics";
import { ProductionChecklist } from "./production-checklist";
import { BatchEvidenceDialog } from "./batch-evidence-dialog";
import { normalizeAccountingDate } from "./accounting-date-picker";
function preparedInputs(
  revision: RevisionView,
  rows: readonly ModelRow[],
): AccountingFormValues {
  const saved = revision.inputs;
  const byId = new Map(saved.lines.map((line) => [line.itemId, line]));
  return {
    ...saved,
    ruleVersionId: revision.ruleVersionId,
    collectionStart: normalizeAccountingDate(saved.collectionStart),
    collectionEnd: normalizeAccountingDate(saved.collectionEnd),
    referenceDate: normalizeAccountingDate(saved.referenceDate),
    lines: rows.map((row) => {
      const line = byId.get(row.id);
      if (line) {
        return {
          ...line,
          activityDate:
            line.activityDate && normalizeAccountingDate(line.activityDate),
        };
      }
      return {
        itemId: row.id,
        state: "RECORDED",
        unit: row.unit,
        evidenceAssetIds: [],
      };
    }),
  };
}
export function AccountingEditor({
  entry,
  factors,
  rules,
  canWrite,
  canReview,
  currentUserId,
}: {
  entry: CaseView;
  factors: FactorOption[];
  rules: RuleOption[];
  canWrite: boolean;
  canReview: boolean;
  currentUserId: string;
}) {
  const searchParams = useSearchParams();
  const chosen = searchParams.get("section");
  const activityItemId = searchParams.get("activity");
  const section =
    chosen && ["method", "activities", "energy"].includes(chosen)
      ? chosen
      : "method";
  const revision = entry.revisions.find(
    (item) => item.id === entry.currentRevisionId,
  )!;
  const content = revision.modelVersion.content;
  const rows = useMemo(() => modelRows(content), [content]);
  const initialValues = useMemo(
    () => preparedInputs(revision, rows),
    [revision, rows],
  );
  const catalogue = useMemo(
    () => ({
      factors: new Map(factors.map((factor) => [factor.id, factor])),
      rules: new Map(rules.map((rule) => [rule.id, rule])),
    }),
    [factors, rules],
  );
  const [annualEdit, setAnnualEdit] = useState<AnnualEnergyEditRequest | null>(
    null,
  );
  const [fieldFocus, setFieldFocus] = useState<{
    section: ReturnType<typeof accountingSection>;
    name: (string | number)[];
    itemId?: string;
  } | null>(null);
  const flow = useAccountingActions(
    entry,
    canWrite,
    canReview,
    currentUserId,
    goToField,
    getProductionIssues,
  );
  const [review, setReview] = useState<"APPROVE" | "REJECT" | null>(null);

  useEffect(() => {
    if (fieldFocus?.section !== section) return;
    if (fieldFocus.itemId && fieldFocus.itemId !== activityItemId) return;
    const frame = requestAnimationFrame(() => {
      flow.form.scrollToField(fieldFocus.name, {
        focus: true,
        block: "center",
      });
      setFieldFocus((current) => (current === fieldFocus ? null : current));
    });
    return () => cancelAnimationFrame(frame);
  }, [activityItemId, fieldFocus, flow.form, section]);

  function getProductionIssues(values: AccountingFormValues) {
    const ruleVersionId = values.ruleVersionId;
    const { requirements, problems } = productionReadiness(values, {
      rows,
      ruleVersionId,
      rule: ruleVersionId ? catalogue.rules.get(ruleVersionId) : undefined,
      factors: catalogue.factors,
    });
    return [...requirements, ...problems];
  }

  function selectSection(value: string, itemId?: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("section", value);
    if (itemId) params.set("activity", itemId);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  function goToField(name: (string | number)[]) {
    const destination = accountingSection(String(name[0]));
    const itemId =
      name[0] === "lines" && typeof name[1] === "number"
        ? rows[name[1]]?.id
        : undefined;
    selectSection(destination, itemId);
    setFieldFocus({ section: destination, name, itemId });
  }

  function goToIssue(issue: CalculationDiagnostic) {
    const target = accountingIssueTarget(
      issue,
      rows,
      flow.form.getFieldValue("annualEnergy") ?? [],
    );
    if (target.annualEdit && flow.editable) {
      selectSection("energy");
      setFieldFocus(null);
      setAnnualEdit(target.annualEdit);
    } else if (target.name) {
      goToField(target.name);
    } else {
      selectSection(accountingSection(issue.path));
      setFieldFocus(null);
    }
  }
  return (
    <EvidenceLibrary>
      <div className="min-w-0 space-y-4">
        <div>
          <Link href="/accounting">← 返回案例列表</Link>
          <Typography.Title level={3} className="!mb-1 break-words">
            {entry.code} · {entry.product}
          </Typography.Title>
          <Space wrap>
            <Tag>修订 v{revision.revisionNo}</Tag>
            <Tag
              color={
                revision.status === "APPROVED"
                  ? "green"
                  : revision.status === "REJECTED"
                    ? "red"
                    : revision.status === "SUBMITTED"
                      ? "blue"
                      : "default"
              }
            >
              {ACCOUNTING_STATUS_LABELS[revision.status]}
            </Tag>
            <Typography.Text type="secondary">
              模型 {revision.modelVersion.model.code} v
              {revision.modelVersion.version}
            </Typography.Text>
          </Space>
        </div>
        <AccountingToolbar
          entry={entry}
          flow={flow}
          canWrite={canWrite}
          onReview={setReview}
          draftTools={
            <>
              <BatchEvidenceDialog
                accountingForm={flow.form}
                rows={rows}
                onApplied={flow.markDirty}
              />
              <ProductionChecklist
                form={flow.form}
                rows={rows}
                getIssues={getProductionIssues}
                additionalIssues={flow.productionErrors}
                dirty={flow.dirty}
                open={flow.productionCheckOpen}
                onOpen={() => void flow.openProductionCheck()}
                onClose={flow.closeProductionCheck}
                onIssue={goToIssue}
              />
            </>
          }
        />
        {flow.dirty && (
          <Alert
            type="warning"
            showIcon
            title="输入尚未保存；保存后需要重新计算"
          />
        )}
        {revision.status === "SUBMITTED" && !flow.reviewable && canReview && (
          <Alert
            type="info"
            showIcon
            title="创建人、最后编辑人或提交人不可审核此修订"
          />
        )}
        {flow.diagnostics.length > 0 && (
          <AccountingDiagnostics
            problems={flow.diagnostics}
            rows={rows}
            annual={flow.form.getFieldValue("annualEnergy") ?? []}
            onIssue={goToIssue}
          />
        )}
        <Form
          form={flow.form}
          layout="vertical"
          initialValues={initialValues}
          onValuesChange={flow.markDirty}
          disabled={!flow.editable}
          onFinishFailed={({ errorFields }) => {
            if (errorFields[0]) goToField(errorFields[0].name);
          }}
        >
          <Tabs
            activeKey={section}
            onChange={selectSection}
            items={[
              {
                key: "method",
                label: "基本信息与方法",
                forceRender: true,
                children: (
                  <CaseMethodForm rules={rules} disabled={!flow.editable} />
                ),
              },
              {
                key: "activities",
                label: "生命周期活动数据",
                forceRender: true,
                children: (
                  <ActivityLines
                    rows={rows}
                    factors={factors}
                    disabled={!flow.editable}
                    selectedItemId={activityItemId}
                    onSelectItem={(id) => selectSection("activities", id)}
                  />
                ),
              },
              {
                key: "energy",
                label: "运行年度电量",
                forceRender: true,
                children: (
                  <AnnualEnergyEditor
                    disabled={!flow.editable}
                    onChange={flow.markDirty}
                    editRequest={annualEdit}
                    onEditRequestClose={() => setAnnualEdit(null)}
                  />
                ),
              },
            ]}
          />
        </Form>
        <Card
          size="small"
          title="运行记录"
          extra={
            <Select
              aria-label="计算运行记录"
              className="w-72 max-w-[55vw]"
              value={flow.selectedRunId ?? undefined}
              placeholder="选择运行"
              options={entry.revisions.flatMap((item) =>
                item.runs.map((run) => ({
                  value: run.id,
                  label: `修订 v${item.revisionNo} · ${run.mode === "TRIAL" ? "试算" : "正式"} · ${formatBeijingTime(run.createdAt)}`,
                })),
              )}
              onChange={flow.setSelectedRunId}
            />
          }
        >
          <RunResults
            run={flow.viewedRun}
            currentInputRevision={revision.inputRevision}
            historical={flow.viewedRevision?.id !== revision.id}
          />
        </Card>
        <AccountingHistory revisions={entry.revisions} />
        <AccountingReviewDialog
          decision={review}
          busy={flow.busy}
          onCancel={() => setReview(null)}
          onReview={(decision, reason) =>
            flow.transition("review", decision, reason)
          }
        />
      </div>
    </EvidenceLibrary>
  );
}
