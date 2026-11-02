"use client";
import { Form, Input, Modal, Typography } from "antd";
export function AccountingReviewDialog({
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
  return (
    <Modal
      title={decision === "APPROVE" ? "审核通过" : "驳回修订"}
      open={!!decision}
      onCancel={onCancel}
      confirmLoading={busy}
      okText="确认"
      cancelText="取消"
      destroyOnHidden
      onOk={() => form.submit()}
    >
      <Typography.Paragraph>
        审核绑定当前提交的运行快照，决定将保留在历史记录中。
      </Typography.Paragraph>
      <Form
        form={form}
        preserve={false}
        layout="vertical"
        onFinish={async ({ reason }) => {
          if (decision && (await onReview(decision, reason ?? ""))) {
            form.resetFields();
            onCancel();
          }
        }}
      >
        <Form.Item
          name="reason"
          label="审核意见"
          rules={[
            {
              required: decision === "REJECT",
              whitespace: true,
              message: "请填写驳回原因",
            },
          ]}
        >
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
