"use client";

import { Alert, Descriptions, Modal, Typography } from "antd";
import type { AdminDataItemEntry } from "@/shared/data-items";

export function DeleteDataItemDialog({
  entry,
  busy,
  error,
  onCancel,
  onDelete,
}: {
  entry: AdminDataItemEntry;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <Modal
      open
      title={`删除 ${entry.code} v${entry.version}`}
      okText="确认删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onCancel={onCancel}
      onOk={onDelete}
    >
      <Typography.Paragraph>
        将删除当前版本，其余版本保留。删除后无法恢复。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        仅允许删除草稿或从未被引用的已发布版本；已被模型引用（含历史记录）的版本只能停用。
      </Typography.Paragraph>
      {error && <Alert type="error" title={error} className="mb-3" />}
      <Descriptions
        size="small"
        column={1}
        items={[
          { key: "name", label: "数据名称", children: entry.dataName },
          {
            key: "code",
            label: "编码 / 版本",
            children: `${entry.code} v${entry.version}`,
          },
          {
            key: "status",
            label: "状态",
            children: entry.retiredAt
              ? "已停用"
              : entry.status === "PUBLISHED"
                ? "已发布"
                : "草稿",
          },
        ]}
      />
    </Modal>
  );
}
