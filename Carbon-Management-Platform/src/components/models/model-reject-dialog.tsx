"use client";

import { Alert, Form, Input, Modal } from "antd";

export function ModelRejectDialog({
  open,
  busy,
  error,
  onCancel,
  onReject,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onReject: (note: string) => Promise<boolean>;
}) {
  const [form] = Form.useForm<{ note: string }>();

  return (
    <Modal
      title="驳回模型版本"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="确认驳回"
      cancelText="取消"
      confirmLoading={busy}
      okButtonProps={{ disabled: busy }}
      destroyOnHidden
    >
      {error && <Alert type="error" title={error} className="mb-3" />}
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        disabled={busy}
        onFinish={async ({ note }) => {
          if (await onReject(note.trim())) {
            form.resetFields();
            onCancel();
          }
        }}
      >
        <Form.Item
          name="note"
          label="驳回理由"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "驳回理由不能为空",
            },
            { max: 2000, message: "驳回理由不能超过 2000 字" },
          ]}
        >
          <Input.TextArea
            maxLength={2000}
            rows={4}
            placeholder="请填写驳回理由（必填），说明需要修改的内容"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
