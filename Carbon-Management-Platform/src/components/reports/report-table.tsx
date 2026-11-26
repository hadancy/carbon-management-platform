"use client";
import { formatBeijingTime } from "@/shared/beijing-time";
import Link from "next/link";
import { Table, Tag } from "antd";
import { REPORT_STATUS_LABELS } from "@/shared/reports";
import type { ReportRow } from "./types";

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  return (
    <Table<ReportRow>
      size="small"
      rowKey="id"
      dataSource={rows}
      scroll={{ x: 850 }}
      pagination={{ pageSize: 10 }}
      columns={[
        {
          title: "报告编号",
          dataIndex: "code",
          render: (value: string, row) => (
            <Link href={"/reports/" + row.id}>{value}</Link>
          ),
        },
        { title: "报告标题", dataIndex: "title", ellipsis: true },
        { title: "核算案例", dataIndex: "caseCode" },
        {
          title: "当前修订",
          dataIndex: "revisionNo",
          render: (value: number) => "v" + value,
        },
        {
          title: "状态",
          dataIndex: "status",
          render: (value: ReportRow["status"]) => (
            <Tag
              color={
                value === "APPROVED"
                  ? "green"
                  : value === "REJECTED"
                    ? "red"
                    : value === "SUBMITTED"
                      ? "blue"
                      : "default"
              }
            >
              {REPORT_STATUS_LABELS[value]}
            </Tag>
          ),
        },
        {
          title: "更新时间",
          dataIndex: "updatedAt",
          render: (value: string) => formatBeijingTime(value),
        },
        {
          title: "操作",
          render: (_, row) => (
            <Link href={"/reports/" + row.id}>编辑 / 查看</Link>
          ),
        },
      ]}
    />
  );
}
