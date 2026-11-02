import { Button, Input, Select, Space } from "antd";
import { ACCOUNTING_STATUS_LABELS } from "@/shared/accounting";
export function AccountingListFilters({
  search,
  status,
  canReview,
  onSearch,
  onStatus,
}: {
  search: string;
  status: string;
  canReview: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
}) {
  return (
    <Space wrap>
      <Input.Search
        placeholder="搜索案例编码或项目名称"
        allowClear
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        className="!w-64 max-w-full"
      />
      <Select
        aria-label="核算状态"
        value={status}
        onChange={onStatus}
        className="!w-36"
        options={[
          { value: "ALL", label: "全部状态" },
          ...Object.entries(ACCOUNTING_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
      />
      {canReview && (
        <Button
          onClick={() => {
            onStatus("SUBMITTED");
            onSearch("");
          }}
        >
          待审核案例
        </Button>
      )}
      <Button
        onClick={() => {
          onStatus("ALL");
          onSearch("");
        }}
      >
        重置筛选
      </Button>
    </Space>
  );
}
