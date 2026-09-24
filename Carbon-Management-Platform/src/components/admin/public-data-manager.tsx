"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Flex, Form, Typography } from "antd";
import { adminRequest } from "./api";
import { PublicDataTable } from "./public-data/public-data-table";
import { PublicDataDialog } from "./public-data/public-data-dialog";
import type { Entry, PublicDataForm } from "./public-data/types";

export function PublicDataManager({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [form] = Form.useForm<PublicDataForm>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const entry = entries.find((item) => item.id === editingId);
    if (entry) {
      form.setFieldsValue({
        type: entry.type,
        code: entry.code,
        version: entry.version,
        title: entry.title,
        source: entry.source ?? "",
        contentText: entry.content,
      });
    } else {
      form.resetFields();
    }
  }, [editingId, entries, form, modalOpen]);

  async function save(values: PublicDataForm) {
    setError("");
    let content: unknown;
    try {
      content = JSON.parse(values.contentText);
    } catch {
      setError("内容必须是有效 JSON");
      return;
    }
    if (!content || Array.isArray(content) || typeof content !== "object") {
      setError("内容必须是 JSON 对象");
      return;
    }

    setBusy(true);
    try {
      await adminRequest(
        editingId
          ? `/api/admin/public-data/${editingId}`
          : "/api/admin/public-data",
        editingId ? "PATCH" : "POST",
        {
          ...(editingId
            ? {}
            : {
                type: values.type,
                code: values.code,
                version: values.version,
              }),
          title: values.title,
          source: values.source,
          content,
        },
      );
      form.resetFields();
      setEditingId(null);
      setModalOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存草稿失败");
    } finally {
      setBusy(false);
    }
  }

  function edit(entry: Entry) {
    setError("");
    setEditingId(entry.id);
    setModalOpen(true);
  }

  function create() {
    setError("");
    setEditingId(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setError("");
    form.resetFields();
  }

  async function publish(entry: Entry) {
    setError("");
    try {
      await adminRequest(
        `/api/admin/public-data/${entry.id}/publish`,
        "POST",
        {},
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败");
    }
  }

  return (
    <Flex vertical gap={14} className="w-full">
      <Flex vertical gap={0}>
        <Typography.Title level={2} className="mt-0 mb-1 text-xl font-semibold">
          公共数据
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          className="m-0 text-[13px] text-[#909399]"
        >
          维护版本化资料；发布后学校用户可只读查看。核算引擎尚未使用这些配置。
        </Typography.Paragraph>
      </Flex>
      {error && !modalOpen && <Alert type="error" title={error} />}
      <PublicDataTable
        entries={entries}
        create={create}
        edit={edit}
        publish={publish}
      />
      <PublicDataDialog
        editingId={editingId}
        modalOpen={modalOpen}
        closeModal={closeModal}
        form={form}
        save={save}
        busy={busy}
        error={error}
      />
    </Flex>
  );
}
