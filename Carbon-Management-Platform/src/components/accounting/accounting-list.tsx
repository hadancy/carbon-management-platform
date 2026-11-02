"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Typography } from "antd";
import { adminRequest } from "@/components/admin/api";
import type { ModelOption } from "./types";
import { AccountingListFilters } from "./accounting-list-filters";
import { AccountingListTable, type CaseRow } from "./accounting-list-table";
import { CreateCaseDialog, type CreateCaseValues } from "./create-case-dialog";
export function AccountingList({
  cases,
  models,
  canWrite,
  canReview,
}: {
  cases: CaseRow[];
  models: ModelOption[];
  canWrite: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(canReview ? "SUBMITTED" : "ALL");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const filtered = cases.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      `${row.code} ${row.product}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function create(values: CreateCaseValues) {
    setBusy(true);
    try {
      const response = await adminRequest<{ case: { id: string } }>(
        "/api/accounting/cases",
        "POST",
        values,
      );
      message.success("核算案例已创建");
      setOpen(false);
      router.push(`/accounting/${response.case.id}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography.Title level={3} className="!mb-1">
            碳足迹核算
          </Typography.Title>
          <Typography.Text type="secondary">
            选择本校已发布模型，记录活动数据、计算和审核。
          </Typography.Text>
        </div>
        {canWrite && (
          <Button
            type="primary"
            disabled={!models.length}
            onClick={() => setOpen(true)}
          >
            新建案例
          </Button>
        )}
      </div>
      <AccountingListFilters
        search={search}
        status={status}
        canReview={canReview}
        onSearch={setSearch}
        onStatus={setStatus}
      />
      <AccountingListTable cases={filtered} />
      <CreateCaseDialog
        open={open}
        busy={busy}
        models={models}
        onCancel={() => setOpen(false)}
        onCreate={create}
      />
    </div>
  );
}
