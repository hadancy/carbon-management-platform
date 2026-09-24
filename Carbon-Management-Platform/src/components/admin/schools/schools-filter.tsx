import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Input, Select, Space } from "antd";
import type { SchoolRow } from "./types";

type Props = {
  keyword: string;
  setKeyword: (value: string) => void;
  status: SchoolRow["status"] | undefined;
  setStatus: (value: SchoolRow["status"] | undefined) => void;
  applyFilters: () => void;
  resetFilters: () => void;
};

export function SchoolsFilter({
  keyword,
  setKeyword,
  status,
  setStatus,
  applyFilters,
  resetFilters,
}: Props) {
  return (
    <Card
      className="border-0 shadow-none [&_.ant-card-body]:p-0"
      variant="borderless"
    >
      <Flex align="center" wrap gap={12} className="w-full">
        <Input
          className="w-55 min-w-45 flex-[0_0_220px] max-[650px]:w-full max-[650px]:basis-full"
          placeholder="学校名称或编码"
          aria-label="学校名称或编码"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onPressEnter={() => applyFilters()}
          allowClear
        />
        <Select
          className="w-55 min-w-45 flex-[0_0_220px] max-[650px]:w-full max-[650px]:basis-full"
          placeholder="全部状态"
          aria-label="学校状态"
          value={status}
          onChange={setStatus}
          allowClear
          options={[
            { value: "ACTIVE", label: "启用" },
            { value: "INACTIVE", label: "停用" },
          ]}
        />
        <Space className="whitespace-nowrap max-[650px]:w-full">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => applyFilters()}
          >
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>
            重置
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}
