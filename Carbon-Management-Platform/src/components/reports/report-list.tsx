"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Typography } from "antd";
import { adminRequest } from "@/components/admin/api";
import type { ReportStatus } from "@/shared/reports";
import type {
  ReportRow,
  ApprovedRunOption,
  ReportTemplateOption,
} from "./types";
import { ReportFilter } from "./report-filter";
import { ReportTable } from "./report-table";
import {
  CreateReportDialog,
  type CreateReportValues,
} from "./create-report-dialog";

export function ReportList({
  rows,
  runs,
  templates,
  canWrite,
  initialRunId,
}: {
  rows: ReportRow[];
  runs: ApprovedRunOption[];
  templates: ReportTemplateOption[];
  canWrite: boolean;
  initialRunId?: string;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(
    canWrite && runs.some((run) => run.id === initialRunId),
  );
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReportStatus>();
  const filtered = rows.filter(
    (row) =>
      (!status || row.status === status) &&
      (row.code + " " + row.title + " " + row.caseCode)
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function create(values: CreateReportValues) {
    setBusy(true);
    try {
      const result = await adminRequest<{ report: { id: string } }>(
        "/api/reports",
        "POST",
        values,
      );
      message.success("报告草稿已生成");
      setOpen(false);
      router.push("/reports/" + result.report.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报告创建失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography.Title level={3} className="!mb-1">
            碳足迹报告
          </Typography.Title>
          <Typography.Text type="secondary">
            从已审核运行生成报告，编辑说明、独立复核并导出 PDF。
          </Typography.Text>
        </div>
        {canWrite && (
          <Button
            type="primary"
            disabled={!runs.length}
            onClick={() => setOpen(true)}
          >
            生成报告
          </Button>
        )}
      </div>
      {!runs.length && (
        <Alert
          type="info"
          showIcon
          title="尚无核算审核通过的运行"
          description="请先在碳足迹核算中完成正式计算与审核，之后即可生成报告。"
        />
      )}
      <ReportFilter
        search={search}
        status={status}
        onSearch={setSearch}
        onStatus={setStatus}
      />
      <ReportTable rows={filtered} />
      <CreateReportDialog
        open={open}
        busy={busy}
        runs={runs}
        templates={templates}
        initialRunId={initialRunId}
        onCancel={() => setOpen(false)}
        onCreate={create}
      />
    </div>
  );
}
