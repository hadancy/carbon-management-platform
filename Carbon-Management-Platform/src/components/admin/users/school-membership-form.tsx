import { Flex, Form, Input, Select, Typography } from "antd";
import type { FormInstance } from "antd";
import {
  SCHOOL_ROLES,
  SCHOOL_ROLE_LABELS,
  isSchoolRole,
} from "@/shared/permissions";
import type { MembershipForm, SchoolOption, UserRow } from "./types";

const roleOptions = SCHOOL_ROLES.map((role) => ({
  value: role,
  label: SCHOOL_ROLE_LABELS[role],
}));

export function SchoolMembershipForm({
  selected,
  schools,
  membershipForm,
  saveMembership,
  fixedSchool,
}: {
  selected: UserRow;
  schools: SchoolOption[];
  membershipForm: FormInstance<MembershipForm>;
  saveMembership: (values: MembershipForm) => Promise<void>;
  fixedSchool?: SchoolOption;
}) {
  return (
    <Flex vertical className="mt-4.5">
      <Typography.Paragraph>
        账号：{selected.displayName}（{selected.email}）
      </Typography.Paragraph>
      <Flex vertical gap={8} className="mt-0 mb-5">
        {selected.memberships.length ? (
          selected.memberships.map((membership) => (
            <Flex
              align="center"
              className="gap-3 rounded border border-[#e4e7ed] bg-[#f8f8f9] px-3 py-2.5 [&_.ant-typography]:text-xs [&_.ant-typography]:text-[#606266]"
              key={membership.schoolId}
            >
              <Flex vertical gap={2}>
                <Typography.Text strong>
                  {membership.schoolName}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {isSchoolRole(membership.role)
                    ? SCHOOL_ROLE_LABELS[membership.role]
                    : membership.role}{" "}
                  · {membership.status === "ACTIVE" ? "启用" : "停用"}
                </Typography.Text>
              </Flex>
            </Flex>
          ))
        ) : (
          <Typography.Text type="secondary">尚未分配学校</Typography.Text>
        )}
      </Flex>
      <Form
        key={selected.id}
        form={membershipForm}
        layout="vertical"
        initialValues={{
          schoolId: fixedSchool?.id ?? selected.memberships[0]?.schoolId,
          role:
            selected.memberships.find(
              (item) => item.schoolId === fixedSchool?.id,
            )?.role ??
            selected.memberships[0]?.role ??
            "VIEWER",
          status:
            selected.memberships.find(
              (item) => item.schoolId === fixedSchool?.id,
            )?.status ??
            selected.memberships[0]?.status ??
            "ACTIVE",
        }}
        onFinish={saveMembership}
        preserve={false}
      >
        {fixedSchool ? (
          <>
            <Form.Item label="学校">{fixedSchool.name}</Form.Item>
            <Form.Item name="schoolId" hidden>
              <Input />
            </Form.Item>
          </>
        ) : (
          <Form.Item label="学校" name="schoolId" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={schools.map((school) => ({
                value: school.id,
                label: school.name,
                disabled:
                  school.status === "INACTIVE" &&
                  !selected.memberships.some(
                    (item) => item.schoolId === school.id,
                  ),
              }))}
              onChange={(value) => {
                const current = selected.memberships.find(
                  (item) => item.schoolId === value,
                );
                membershipForm.setFieldsValue({
                  role: current?.role ?? "VIEWER",
                  status: current?.status ?? "ACTIVE",
                });
              }}
            />
          </Form.Item>
        )}
        <Form.Item label="校内角色" name="role" rules={[{ required: true }]}>
          <Select options={roleOptions} />
        </Form.Item>
        <Form.Item label="归属状态" name="status" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "ACTIVE", label: "启用" },
              { value: "INACTIVE", label: "停用" },
            ]}
          />
        </Form.Item>
      </Form>
    </Flex>
  );
}
