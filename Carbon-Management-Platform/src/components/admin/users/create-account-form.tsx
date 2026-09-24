import { Form, Input, Select } from "antd";
import type { FormInstance } from "antd";
import { SCHOOL_ROLES, SCHOOL_ROLE_LABELS } from "@/shared/permissions";
import type { AccountForm, SchoolOption } from "./types";

const roleOptions = SCHOOL_ROLES.map((role) => ({
  value: role,
  label: SCHOOL_ROLE_LABELS[role],
}));

export function CreateAccountForm({
  createForm,
  createAccount,
  schools,
  fixedSchool,
}: {
  createForm: FormInstance<AccountForm>;
  createAccount: (values: AccountForm) => Promise<void>;
  schools: SchoolOption[];
  fixedSchool?: SchoolOption;
}) {
  return (
    <Form
      form={createForm}
      layout="vertical"
      initialValues={{ role: "SCHOOL_ADMIN", schoolId: fixedSchool?.id }}
      onFinish={createAccount}
      preserve={false}
      className="mt-5"
    >
      <Form.Item
        label="登录邮箱"
        name="email"
        rules={[{ required: true, type: "email" }]}
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item
        label="姓名"
        name="displayName"
        rules={[{ required: true, min: 2, max: 120 }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="初始密码"
        name="password"
        rules={[{ required: true, min: 12, message: "至少 12 位" }]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      {fixedSchool ? (
        <>
          <Form.Item label="所属学校">{fixedSchool.name}</Form.Item>
          <Form.Item name="schoolId" hidden>
            <Input />
          </Form.Item>
        </>
      ) : (
        <Form.Item
          label="所属学校"
          name="schoolId"
          rules={[{ required: true }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={schools
              .filter((school) => school.status === "ACTIVE")
              .map((school) => ({ value: school.id, label: school.name }))}
          />
        </Form.Item>
      )}
      <Form.Item label="校内角色" name="role" rules={[{ required: true }]}>
        <Select options={roleOptions} />
      </Form.Item>
    </Form>
  );
}
