import { Form, Input } from "antd";
import type { FormInstance } from "antd";
import type { UserRow } from "./types";

export function EditAccountForm({
  selected,
  editForm,
  updateAccount,
}: {
  selected: UserRow;
  editForm: FormInstance<{ displayName: string }>;
  updateAccount: (values: { displayName: string }) => Promise<void>;
}) {
  return (
    <Form
      key={selected.id}
      form={editForm}
      layout="vertical"
      initialValues={{ displayName: selected.displayName }}
      onFinish={updateAccount}
      preserve={false}
      className="mt-5"
    >
      <Form.Item label="登录邮箱">
        <Input value={selected.email} disabled />
      </Form.Item>
      <Form.Item
        label="姓名"
        name="displayName"
        rules={[{ required: true, min: 2, max: 120 }]}
      >
        <Input />
      </Form.Item>
    </Form>
  );
}
