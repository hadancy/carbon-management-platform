import { formatBeijingTime } from "@/shared/beijing-time";
import Link from "next/link";
import { Table, Tag } from "antd";
import {
  ACCOUNTING_STATUS_LABELS,
  type AccountingStatus,
} from "@/shared/accounting";
export type CaseRow = {
  id: string;
  code: string;
  product: string;
  currentRevisionId: string | null;
  status: AccountingStatus;
  updatedAt: string;
};
export function AccountingListTable({ cases }: { cases: CaseRow[] }) {
  return (
    <Table
      rowKey="id"
      dataSource={cases}
      scroll={{ x: 750 }}
      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个案例` }}
      columns={[
        {
          title: "案例编码",
          dataIndex: "code",
          render: (value: string, row: CaseRow) => (
            <Link href={`/accounting/${row.id}`}>{value}</Link>
          ),
        },
        { title: "产品 / 项目", dataIndex: "product" },
        {
          title: "状态",
          dataIndex: "status",
          render: (value: AccountingStatus) => (
            <Tag
              color={
                value === "APPROVED"
                  ? "green"
                  : value === "SUBMITTED"
                    ? "blue"
                    : value === "REJECTED"
                      ? "red"
                      : "default"
              }
            >
              {ACCOUNTING_STATUS_LABELS[value]}
            </Tag>
          ),
        },
        {
          title: "更新时间",
          dataIndex: "updatedAt",
          render: (value: string) => formatBeijingTime(value),
          sorter: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
        },
        {
          title: "操作",
          render: (_: unknown, row: CaseRow) => (
            <Link href={`/accounting/${row.id}`}>
              {row.status === "SUBMITTED" ? "查看审核" : "查看"}
            </Link>
          ),
        },
      ]}
    />
  );
}
