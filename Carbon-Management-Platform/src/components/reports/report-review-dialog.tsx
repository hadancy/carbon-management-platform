"use client";
import { Form, Input, Modal } from "antd";

export function ReportReviewDialog({
  decision,
  busy,
  onCancel,
  onReview,
}: {
  decision: "APPROVE" | "REJECT" | null;
  busy: boolean;
  onCancel: () => void;
  onReview: (
    decision: "APPROVE" | "REJECT",
    reason: string,
  ) => Promise<boolean>;
}) {
  const [form] = Form.useForm<{ reason: string }>();
  async function submit() {
    try {
      const values = await form.validateFields();
      if (decision && (await onReview(decision, values.reason))) {
        form.resetFields();
        onCancel();
      }
    } catch {
      /* Field validation remains in the dialog. */
    }
  }
  return (
    <Modal
      title={decision === "APPROVE" ? "审核通过报告" : "驳回报告修订"}
      open={!!decision}
      confirmLoading={busy}
      onCancel={onCancel}
      onOk={submit}
      okText={decision === "APPROVE" ? "确认通过" : "确认驳回"}
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={busy}>
        <Form.Item
          label="审核意见"
          name="reason"
          rules={[
            { required: true, whitespace: true, message: "请填写审核意见" },
            { max: 2000 },
          ]}
        >
          <Input.TextArea rows={5} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
