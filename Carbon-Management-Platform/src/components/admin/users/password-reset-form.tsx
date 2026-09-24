import { Alert, Flex, Form, Input } from "antd";
import type { FormInstance } from "antd";
import type { UserRow } from "./types";

export function PasswordResetForm({
  selected,
  passwordForm,
  resetPassword,
}: {
  selected: UserRow;
  passwordForm: FormInstance<{ newPassword: string }>;
  resetPassword: (values: { newPassword: string }) => Promise<void>;
}) {
  return (
    <Flex vertical className="mt-4.5">
      <Alert
        type="warning"
        title={`为 ${selected.displayName} 重置密码后，原有登录会话会失效。`}
        className="mb-4.5"
      />
      <Form
        form={passwordForm}
        layout="vertical"
        onFinish={resetPassword}
        preserve={false}
      >
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[{ required: true, min: 12, message: "至少 12 位" }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Flex>
  );
}
