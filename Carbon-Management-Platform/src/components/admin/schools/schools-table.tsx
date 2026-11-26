import { formatBeijingTime } from "@/shared/beijing-time";
import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { SchoolRow } from "./types";

type Props = {
  visibleSchools: SchoolRow[];
  openModal: (school: SchoolRow | null) => void;
  onManageAccounts: (school: SchoolRow) => void;
  toggleStatus: (school: SchoolRow) => Promise<void>;
  statusBusyId: string | null;
};

export function SchoolsTable({
  visibleSchools,
  openModal,
  onManageAccounts,
  toggleStatus,
  statusBusyId,
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
          学校列表
        </Typography.Text>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal(null)}
        >
          新增学校
        </Button>
      </Flex>
      <Table<SchoolRow>
        rowKey="id"
        dataSource={visibleSchools}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 760 }}
        columns={[
          { title: "学校编码", dataIndex: "code", width: 170 },
          { title: "学校名称", dataIndex: "name", ellipsis: true },
          {
            title: "账号归属",
            dataIndex: "memberCount",
            width: 110,
            render: (count: number) => `${count} 人`,
          },
          {
            title: "创建时间",
            dataIndex: "createdAt",
            width: 180,
            render: (value: string) => formatBeijingTime(value),
          },
          {
            title: "状态",
            width: 100,
            render: (_, school) => (
              <Tag color={school.status === "ACTIVE" ? "green" : "default"}>
                {school.status === "ACTIVE" ? "启用" : "停用"}
              </Tag>
            ),
          },
          {
            title: "操作",
            width: 235,
            render: (_, school) => (
              <Space className="whitespace-nowrap">
                <Button
                  type="link"
                  size="small"
                  onClick={() => onManageAccounts(school)}
                >
                  管理账号
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => openModal(school)}
                >
                  编辑
                </Button>
                <Popconfirm
                  title={
                    school.status === "ACTIVE"
                      ? "停用这所学校？"
                      : "启用这所学校？"
                  }
                  description={
                    school.status === "ACTIVE"
                      ? "停用后，该校账号将暂时无法访问学校数据。"
                      : undefined
                  }
                  onConfirm={() => toggleStatus(school)}
                  okButtonProps={{ loading: statusBusyId === school.id }}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button
                    type="link"
                    size="small"
                    danger={school.status === "ACTIVE"}
                  >
                    {school.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
