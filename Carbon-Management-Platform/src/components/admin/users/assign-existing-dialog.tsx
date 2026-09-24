import { Alert, Form, Modal, Select, Typography } from "antd";
import type { FormInstance } from "antd";
import { SCHOOL_ROLES, SCHOOL_ROLE_LABELS } from "@/shared/permissions";
import type { UserRow } from "./types";

export type AssignExistingForm = { userId: string; role: string };

export function AssignExistingDialog({
  open,
  schoolName,
  candidates,
  initialRole,
  form,
  busy,
  error,
  onCancel,
  onFinish,
}: {
  open: boolean;
  schoolName: string;
  candidates: UserRow[];
  initialRole: string;
  form: FormInstance<AssignExistingForm>;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onFinish: (values: AssignExistingForm) => Promise<void>;
}) {
  return (
    <Modal
      title="添加已有账号"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={busy}
      okText="添加到学校"
      cancelText="取消"
      destroyOnHidden
    >
      {error && <Alert type="error" title={error} className="my-4" />}
      <Typography.Paragraph className="mt-4">
        将已有账号添加到「{schoolName}」，不影响其在其他学校的归属。
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ role: initialRole }}
        onFinish={onFinish}
        preserve={false}
      >
        <Form.Item label="账号" name="userId" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="搜索姓名或邮箱"
            options={candidates.map((user) => ({
              value: user.id,
              label: `${user.displayName}（${user.email}）`,
            }))}
          />
        </Form.Item>
        <Form.Item label="校内角色" name="role" rules={[{ required: true }]}>
          <Select
            options={SCHOOL_ROLES.map((role) => ({
              value: role,
              label: SCHOOL_ROLE_LABELS[role],
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
