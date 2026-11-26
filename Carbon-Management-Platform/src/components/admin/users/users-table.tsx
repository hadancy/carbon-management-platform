import { formatBeijingTime } from "@/shared/beijing-time";
import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Dropdown,
  Flex,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { SCHOOL_ROLE_LABELS, isSchoolRole } from "@/shared/permissions";
import type { Dialog, UserRow } from "./types";

type Props = {
  visibleUsers: UserRow[];
  openDialog: (next: Exclude<Dialog, null>, user?: UserRow | null) => void;
  setError: (value: string) => void;
  setStatusTarget: (user: UserRow | null) => void;
  setDeleteTarget: (user: UserRow | null) => void;
  setRemoveTarget: (user: UserRow | null) => void;
  schoolId?: string;
  schoolActive?: boolean;
  onAssignExisting: () => void;
};

export function UsersTable({
  visibleUsers,
  openDialog,
  setError,
  setStatusTarget,
  setDeleteTarget,
  setRemoveTarget,
  schoolId,
  schoolActive,
  onAssignExisting,
}: Props) {
  return (
    <Card
      className="border-0 shadow-none [&_.ant-card-body]:p-0"
      variant="borderless"
    >
      <Flex
        justify="space-between"
        align="center"
        className="my-3 mb-3.5 gap-3"
      >
        <Typography.Text
          strong
          className="text-sm font-semibold text-[#515a6e]"
        >
          {schoolId ? "该校账号" : "账号列表"}
        </Typography.Text>
        <Space>
          {schoolId && (
            <Button onClick={onAssignExisting} disabled={!schoolActive}>
              添加已有账号
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openDialog("create")}
            disabled={schoolId ? !schoolActive : false}
          >
            新增账号
          </Button>
        </Space>
      </Flex>
      <Table<UserRow>
        rowKey="id"
        dataSource={visibleUsers}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 980 }}
        columns={[
          {
            title: "姓名",
            dataIndex: "displayName",
            width: 150,
            ellipsis: true,
          },
          {
            title: "登录邮箱",
            dataIndex: "email",
            width: 240,
            ellipsis: true,
          },
          {
            title: schoolId ? "校内角色" : "学校与角色",
            render: (_, user) =>
              (schoolId
                ? user.memberships.filter((item) => item.schoolId === schoolId)
                : user.memberships
              ).length ? (
                <Space wrap size={[4, 4]}>
                  {(schoolId
                    ? user.memberships.filter(
                        (item) => item.schoolId === schoolId,
                      )
                    : user.memberships
                  ).map((membership) => (
                    <Tag
                      key={membership.schoolId}
                      color={
                        membership.status === "ACTIVE" ? "blue" : "default"
                      }
                    >
                      {membership.schoolName} ·{" "}
                      {isSchoolRole(membership.role)
                        ? SCHOOL_ROLE_LABELS[membership.role]
                        : membership.role}
                      {membership.status === "INACTIVE" ? "（停用）" : ""}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">未分配学校</Typography.Text>
              ),
          },
          {
            title: "创建时间",
            dataIndex: "createdAt",
            width: 180,
            render: (value: string) => formatBeijingTime(value),
          },
          {
            title: "状态",
            width: 85,
            render: (_, user) => (
              <Tag color={user.status === "ACTIVE" ? "green" : "default"}>
                {user.status === "ACTIVE" ? "启用" : "停用"}
              </Tag>
            ),
          },
          {
            title: "操作",
            width: 210,
            render: (_, user) =>
              user.isPlatformAdmin ? (
                <Space className="whitespace-nowrap" size={0}>
                  <Tag color="gold">平台管理员</Tag>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openDialog("membership", user)}
                  >
                    {schoolId ? "校内角色" : "学校归属"}
                  </Button>
                  {schoolId && (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => setRemoveTarget(user)}
                    >
                      移除归属
                    </Button>
                  )}
                </Space>
              ) : (
                <Space className="whitespace-nowrap" size={0}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openDialog("edit", user)}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openDialog("membership", user)}
                  >
                    {schoolId ? "校内角色" : "学校归属"}
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        { key: "password", label: "重置密码" },
                        {
                          key: "status",
                          label:
                            user.status === "ACTIVE" ? "停用账号" : "启用账号",
                          danger: user.status === "ACTIVE",
                        },
                        ...(schoolId
                          ? [
                              {
                                key: "remove",
                                label: "移除该校归属",
                                danger: true,
                              },
                            ]
                          : []),
                        { key: "delete", label: "删除账号", danger: true },
                      ],
                      onClick: ({ key }) => {
                        if (key === "password") {
                          openDialog("password", user);
                        } else if (key === "delete") {
                          setError("");
                          setDeleteTarget(user);
                        } else if (key === "remove") {
                          setError("");
                          setRemoveTarget(user);
                        } else {
                          setError("");
                          setStatusTarget(user);
                        }
                      },
                    }}
                  >
                    <Button type="link" size="small">
                      更多
                    </Button>
                  </Dropdown>
                </Space>
              ),
          },
        ]}
      />
    </Card>
  );
}
