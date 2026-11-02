import { Card, Table, Tag } from "antd";
import { ACCOUNTING_STATUS_LABELS } from "@/shared/accounting";
import type { RevisionView } from "./types";
export function AccountingHistory({
  revisions,
}: {
  revisions: RevisionView[];
}) {
  return (
    <Card size="small" title="修订与审核历史">
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        scroll={{ x: 650 }}
        dataSource={revisions}
        columns={[
          {
            title: "修订",
            dataIndex: "revisionNo",
            render: (value: number) => `v${value}`,
          },
          {
            title: "状态",
            dataIndex: "status",
            render: (value: RevisionView["status"]) => (
              <Tag>{ACCOUNTING_STATUS_LABELS[value]}</Tag>
            ),
          },
          {
            title: "计算运行数",
            dataIndex: "runs",
            render: (value: RevisionView["runs"]) => value.length,
          },
          {
            title: "审核意见",
            dataIndex: "reviews",
            render: (value: RevisionView["reviews"]) =>
              value
                .map(
                  (review) =>
                    `${review.decision === "APPROVE" ? "通过" : "驳回"}：${review.reason || "无"}`,
                )
                .join("；") || "—",
          },
        ]}
      />
    </Card>
  );
}
