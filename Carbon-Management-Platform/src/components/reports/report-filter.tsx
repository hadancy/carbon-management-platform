"use client";
import { Input, Select, Space } from "antd";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/shared/reports";

export function ReportFilter({
  search,
  status,
  onSearch,
  onStatus,
}: {
  search: string;
  status: ReportStatus | undefined;
  onSearch: (value: string) => void;
  onStatus: (value: ReportStatus | undefined) => void;
}) {
  return (
    <Space wrap>
      <Input.Search
        aria-label="搜索报告"
        placeholder="报告编号、标题或核算案例"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        allowClear
        className="w-72 max-w-full"
      />
      <Select
        aria-label="报告状态"
        placeholder="全部状态"
        allowClear
        value={status}
        onChange={onStatus}
        className="w-36"
        options={Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
    </Space>
  );
}
