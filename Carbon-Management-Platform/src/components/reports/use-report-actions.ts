"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "antd";
import type { FormInstance } from "antd";
import { adminRequest } from "@/components/admin/api";
import type { ReportContent } from "@/shared/reports";
import type { ReportRevisionView } from "./types";

export function useReportActions({
  reportId,
  reportCode,
  revision,
  form,
  dirty,
  onSaved,
  onClean,
}: {
  reportId: string;
  reportCode: string;
  revision: ReportRevisionView;
  form: FormInstance<ReportContent>;
  dirty: boolean;
  onSaved: (revision: ReportRevisionView) => void;
  onClean: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { message } = App.useApp();
  const router = useRouter();
  const path = "/api/reports/" + reportId;
  const request = (target = revision) => ({
    revisionId: target.id,
    expectedContentRevision: target.contentRevision,
  });
  async function perform(task: () => Promise<void>) {
    if (busy) return false;
    setBusy(true);
    try {
      await task();
      return true;
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error))
        message.error(error instanceof Error ? error.message : "报告操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function persistDraft() {
    const response = await adminRequest<{
      revision: Omit<ReportRevisionView, "export">;
    }>(path, "PATCH", { ...request(), content: form.getFieldsValue(true) });
    const next = { ...revision, ...response.revision };
    onSaved(next);
    onClean();
    return next;
  }
  const save = () =>
    perform(async () => {
      await persistDraft();
      message.success("报告草稿已保存");
    });
  const submit = () =>
    perform(async () => {
      await form.validateFields();
      const target = dirty ? await persistDraft() : revision;
      await adminRequest(path + "/submit", "POST", request(target));
      onClean();
      message.success("报告已提交审核");
      router.refresh();
    });
  const revise = () =>
    perform(async () => {
      await adminRequest(path + "/revisions", "POST", request());
      onClean();
      message.success("新报告修订已创建，原版继续保留");
      router.refresh();
    });
  const review = (decision: "APPROVE" | "REJECT", reason: string) =>
    perform(async () => {
      await adminRequest(path + "/review", "POST", {
        ...request(),
        decision,
        reason,
      });
      message.success(decision === "APPROVE" ? "报告审核通过" : "报告已驳回");
      router.refresh();
    });
  const exportPdf = () =>
    perform(async () => {
      const response = await fetch(
        "/api/report-revisions/" + revision.id + "/pdf",
        { method: "POST" },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "PDF 导出失败");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = reportCode + "-v" + revision.revisionNo + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.success("PDF 已导出");
    });
  return { busy, save, submit, revise, review, exportPdf };
}
