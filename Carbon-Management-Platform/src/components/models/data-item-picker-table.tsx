"use client";

import { Descriptions, Empty, Table, Typography } from "antd";
import type { DataItemCatalogQuery, DataItemEntry } from "@/shared/data-items";
import { factorUnitLabel, unitSymbol } from "@/shared/units";

export function DataItemPickerTable({
  entries,
  total,
  query,
  loading,
  selected,
  excludedIds,
  replacing,
  limit,
  onSelect,
  onPage,
}: {
  entries: DataItemEntry[];
  total: number;
  query: DataItemCatalogQuery;
  loading: boolean;
  selected: DataItemEntry[];
  excludedIds: string[];
  replacing: boolean;
  limit: number;
  onSelect: (entries: DataItemEntry[]) => void;
  onPage: (page: number, pageSize: number) => void;
}) {
  return (
    <Table<DataItemEntry>
      size="small"
      rowKey="id"
      dataSource={entries}
      loading={loading}
      scroll={{ x: 1030 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              query.q || query.unit
                ? "没有符合条件的公共数据项，请调整搜索或联系平台管理员补充。"
                : "暂无可用数据项，请联系平台管理员新增并发布。"
            }
          />
        ),
      }}
      rowSelection={{
        type: replacing ? "radio" : "checkbox",
        selectedRowKeys: selected.map((entry) => entry.id),
        preserveSelectedRowKeys: true,
        hideSelectAll: true,
        getCheckboxProps: (entry) => ({
          disabled:
            excludedIds.includes(entry.dataItemId) ||
            (!replacing &&
              selected.some(
                (other) =>
                  other.dataItemId === entry.dataItemId &&
                  other.id !== entry.id,
              )) ||
            (!replacing &&
              selected.length >= limit &&
              !selected.some((other) => other.id === entry.id)),
        }),
        onChange: (keys, rows) => {
          const known = new Map(
            [...selected, ...entries, ...rows].map((entry) => [
              entry.id,
              entry,
            ]),
          );
          onSelect(
            keys.flatMap((key) =>
              known.has(String(key)) ? [known.get(String(key))!] : [],
            ),
          );
        },
      }}
      pagination={{
        current: query.page,
        pageSize: query.pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (count) => `共 ${count} 个可用版本`,
        onChange: onPage,
      }}
      expandable={{
        expandedRowRender: (entry) => (
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2 }}
            items={[
              {
                key: "carbon",
                label: "原始碳足迹因子资料",
                children: entry.carbonFootprintFactor || "—",
              },
              {
                key: "factor-source",
                label: "因子来源",
                children: entry.factorSource || "—",
              },
              {
                key: "data-source",
                label: "数据来源",
                children: entry.dataSource || "—",
              },
            ]}
          />
        ),
      }}
      columns={[
        { title: "编码", dataIndex: "code", width: 150, ellipsis: true },
        {
          title: "版本",
          dataIndex: "version",
          width: 65,
          render: (value: number) => `v${value}`,
        },
        {
          title: "数据名称",
          dataIndex: "dataName",
          width: 160,
          ellipsis: true,
        },
        {
          title: "规格型号",
          dataIndex: "specModel",
          width: 130,
          ellipsis: true,
          render: (value: string) => value || "—",
        },
        {
          title: "生产厂家",
          dataIndex: "manufacturer",
          width: 145,
          ellipsis: true,
          render: (value: string) => value || "—",
        },
        {
          title: "活动单位",
          dataIndex: "functionalUnit",
          width: 95,
          render: unitSymbol,
        },
        {
          title: "排放因子",
          width: 160,
          render: (_, entry) =>
            entry.emissionFactor ? (
              `${entry.emissionFactor} ${factorUnitLabel(entry.functionalUnit)}`
            ) : (
              <Typography.Text type="secondary">未填写</Typography.Text>
            ),
        },
      ]}
    />
  );
}
