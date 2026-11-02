"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type {
  DataItemEntry,
  AdminDataItemList,
  AdminDataItemEntry,
  DataItemListQuery,
} from "@/shared/data-items";
import { adminRequest } from "../api";
import { DataItemFilters } from "./data-item-filters";
import { DataItemTable } from "./data-item-table";
import {
  DataItemDialog,
  type DataItemEditor,
  type DataItemFormValues,
} from "./data-item-dialog";
import { DataItemDetails } from "./data-item-details";
import { RetireDataItemDialog } from "./retire-data-item-dialog";
import { DeleteDataItemDialog } from "./delete-data-item-dialog";

export function DataItemsManager({ entries, total, query }: AdminDataItemList) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<DataItemEditor | null>(null);
  const [detail, setDetail] = useState<DataItemEntry | null>(null);
  const [retireTarget, setRetireTarget] = useState<DataItemEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDataItemEntry | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function navigate(next: DataItemListQuery) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.unit) params.set("unit", next.unit);
    if (next.status !== "ALL") params.set("status", next.status);
    if (next.page !== 1) params.set("page", String(next.page));
    if (next.pageSize !== 20) params.set("pageSize", String(next.pageSize));
    startTransition(() =>
      router.replace(`/admin/data-items${params.size ? `?${params}` : ""}`),
    );
  }

  function openEditor(next: DataItemEditor) {
    setError("");
    setEditor(next);
  }

  async function save(values: DataItemFormValues) {
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    const { code, ...fields } = values;
    let url = "/api/admin/data-items";
    let method: "POST" | "PATCH" = "POST";
    let input: unknown = { ...fields, code };
    if (editor.mode !== "create") {
      url = `/api/admin/data-items/${editor.entry.id}`;
      input = { ...fields, revision: editor.entry.revision };
      if (editor.mode === "edit") method = "PATCH";
      else if (editor.mode === "publish") url += "/publish";
      else {
        url += "/new-version";
        input = fields;
      }
    }
    try {
      const saved = await adminRequest<{ entry: DataItemEntry }>(
        url,
        method,
        input,
      );
      setEditor(null);
      if (editor.mode === "create" || editor.mode === "new-version")
        navigate({
          ...query,
          q: saved.entry.code,
          status: "ALL",
          unit: "",
          page: 1,
        });
      router.refresh();
      void message.success(
        editor.mode === "publish" ? "数据项已发布" : "数据项草稿已保存",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function retire(reason: string) {
    if (!retireTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(
        `/api/admin/data-items/${retireTarget.id}/retire`,
        "POST",
        { reason, revision: retireTarget.revision },
      );
      setRetireTarget(null);
      router.refresh();
      void message.success("数据项版本已停用");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "停用失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/data-items/${deleteTarget.id}`, "DELETE", {
        revision: deleteTarget.revision,
      });
      setDeleteTarget(null);
      router.refresh();
      void message.success("数据项版本已删除");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex vertical gap={16} className="w-full min-w-0">
      <Flex vertical gap={0}>
        <Typography.Title level={2} className="mt-0 mb-1 text-xl font-semibold">
          公共数据项库
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="m-0 text-[13px]">
          统一维护可复用的数据项资料；未引用的版本可删除，已有引用保留历史。
        </Typography.Paragraph>
      </Flex>
      <Card size="small" className="shadow-none">
        <DataItemFilters
          query={query}
          loading={pending}
          onSearch={(filters) => navigate({ ...query, ...filters, page: 1 })}
        />
      </Card>
      <Card
        variant="borderless"
        className="min-w-0 shadow-none [&_.ant-card-body]:p-0"
      >
        <Flex
          align="center"
          justify="space-between"
          wrap
          gap={12}
          className="mb-3"
        >
          <Typography.Text strong>数据项版本列表</Typography.Text>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            disabled={busy || pending}
            onClick={() => openEditor({ mode: "create", entry: null })}
          >
            新增数据项
          </Button>
        </Flex>
        <DataItemTable
          entries={entries}
          total={total}
          query={query}
          loading={pending}
          busy={busy || pending}
          onPage={(page, pageSize) => navigate({ ...query, page, pageSize })}
          onView={setDetail}
          onEdit={(entry) => openEditor({ mode: "edit", entry })}
          onPublish={(entry) => openEditor({ mode: "publish", entry })}
          onNewVersion={(entry) => openEditor({ mode: "new-version", entry })}
          onRetire={(entry) => {
            setError("");
            setRetireTarget(entry);
          }}
          onDelete={(entry) => {
            setError("");
            setDeleteTarget(entry);
          }}
        />
      </Card>
      {editor && (
        <DataItemDialog
          editor={editor}
          busy={busy}
          error={error}
          onCancel={() => setEditor(null)}
          onSave={save}
        />
      )}
      {detail && (
        <DataItemDetails entry={detail} onClose={() => setDetail(null)} />
      )}
      {deleteTarget && (
        <DeleteDataItemDialog
          entry={deleteTarget}
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) setDeleteTarget(null);
          }}
          onDelete={remove}
        />
      )}
      {retireTarget && (
        <RetireDataItemDialog
          entry={retireTarget}
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) setRetireTarget(null);
          }}
          onRetire={retire}
        />
      )}
    </Flex>
  );
}
