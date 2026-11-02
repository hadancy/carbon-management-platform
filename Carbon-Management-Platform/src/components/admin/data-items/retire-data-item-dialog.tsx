"use client";

import { Alert, Form, Input, Modal, Typography } from "antd";
import type { DataItemEntry } from "@/shared/data-items";

export function RetireDataItemDialog({
  entry,
  busy,
  error,
  onCancel,
  onRetire,
}: {
  entry: DataItemEntry;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onRetire: (reason: string) => Promise<void>;
}) {
  const [form] = Form.useForm<{ reason: string }>();
  return (
    <Modal
      open
      title={`停用 ${entry.code} v${entry.version}`}
      okText="确认停用"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Typography.Paragraph type="secondary">
        停用后不再供新选用，已保存的版本内容和历史记录继续保留。
      </Typography.Paragraph>
      {error && <Alert type="error" title={error} className="mb-3" />}
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onRetire(values.reason)}
      >
        <Form.Item
          label="停用原因"
          name="reason"
          rules={[
            { required: true, whitespace: true, message: "请填写停用原因" },
            { max: 1000 },
          ]}
        >
          <Input.TextArea rows={3} maxLength={1000} disabled={busy} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
