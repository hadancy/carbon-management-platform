import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Space, Table, Tag, Typography } from "antd";
import { parseEmissionFactorContent } from "@/shared/emission-factors";
import { factorUnitLabel, isKnownUnit } from "@/shared/units";
import type { Entry } from "./types";
import { typeLabels } from "./types";

type Props = {
  entries: Entry[];
  create: () => void;
  edit: (entry: Entry) => void;
  publish: (entry: Entry) => void;
  copyFactor: (entry: Entry) => void;
  retire: (entry: Entry) => void;
};

function factorSummary(entry: Entry) {
  if (entry.type !== "EMISSION_FACTOR") return "—";
  const factor = parseEmissionFactorContent(entry.content);
  if (!factor) return "旧格式，待核对";
  return factor.value && isKnownUnit(factor.activityUnit)
    ? `${factor.value} ${factorUnitLabel(factor.activityUnit)}`
    : "待填写";
}

export function PublicDataTable({
  entries,
  create,
  edit,
  publish,
  copyFactor,
  retire,
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
          版本列表
        </Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={create}>
          新增公共数据
        </Button>
      </Flex>
      <Table<Entry>
        rowKey="id"
        dataSource={entries}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 920 }}
        expandable={{
          expandedRowRender: (entry) => (
            <pre className="whitespace-pre-wrap">{entry.content}</pre>
          ),
        }}
        columns={[
          { title: "类型", render: (_, entry) => typeLabels[entry.type] },
          { title: "编码", dataIndex: "code" },
          { title: "版本", dataIndex: "version" },
          { title: "标题", dataIndex: "title" },
          { title: "来源", dataIndex: "source" },
          {
            title: "因子数值/单位",
            render: (_, entry) => factorSummary(entry),
          },
          {
            title: "状态",
            render: (_, entry) => (
              <Tag
                color={
                  entry.retiredAt
                    ? "orange"
                    : entry.status === "PUBLISHED"
                      ? "green"
                      : "default"
                }
              >
                {entry.retiredAt
                  ? "已停用"
                  : entry.status === "PUBLISHED"
                    ? "已发布"
                    : "草稿"}
              </Tag>
            ),
          },
          {
            title: "操作",
            render: (_, entry) =>
              entry.status === "DRAFT" ? (
                <Space>
                  <Button type="link" size="small" onClick={() => edit(entry)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => publish(entry)}
                  >
                    发布
                  </Button>
                </Space>
              ) : entry.type === "EMISSION_FACTOR" ? (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => copyFactor(entry)}
                  >
                    升级为新版本
                  </Button>
                  {!entry.retiredAt && (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => retire(entry)}
                    >
                      停用
                    </Button>
                  )}
                </Space>
              ) : (
                <Typography.Text type="secondary">只读</Typography.Text>
              ),
          },
        ]}
      />
    </Card>
  );
}
