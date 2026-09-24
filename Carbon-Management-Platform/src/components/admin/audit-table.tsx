"use client";

import { Card, Flex, Table, Typography } from "antd";

type AuditRow = {
  id: string;
  time: string;
  actor: string;
  school: string;
  action: string;
  targetType: string;
  targetId: string;
};

export function AuditTable({ logs }: { logs: AuditRow[] }) {
  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={0}>
        <Typography.Title level={2} className="mb-1">
          审计日志
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          显示最近 100 条学校、账号、归属和公共数据操作记录。
        </Typography.Paragraph>
      </Flex>
      <Card variant="borderless" className="shadow-none [&_.ant-card-body]:p-0">
        <Table<AuditRow>
          rowKey="id"
          dataSource={logs}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
          columns={[
            {
              title: "时间",
              dataIndex: "time",
              render: (value: string) =>
                new Date(value).toLocaleString("zh-CN"),
            },
            { title: "操作者", dataIndex: "actor" },
            { title: "范围", dataIndex: "school" },
            { title: "动作", dataIndex: "action" },
            {
              title: "对象",
              render: (_, row) => `${row.targetType} · ${row.targetId}`,
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
