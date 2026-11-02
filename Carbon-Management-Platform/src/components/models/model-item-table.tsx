"use client";

import {
  Button,
  Descriptions,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ModelItem } from "@/shared/models";
import {
  factorUnitLabel,
  isKnownUnit,
  isNumericFactor,
  unitSymbol,
} from "@/shared/units";

const display = (value: string) =>
  value || <Typography.Text type="secondary">未填写</Typography.Text>;

export function ModelItemTable({
  items,
  readOnly,
  onReplace,
  onMove,
  onDelete,
}: {
  items: ModelItem[];
  readOnly: boolean;
  onReplace: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Table<ModelItem>
      size="small"
      rowKey="id"
      pagination={false}
      scroll={{ x: readOnly ? 850 : 1070 }}
      locale={{ emptyText: "暂无数据项" }}
      dataSource={items}
      expandable={{
        expandedRowRender: (item) => (
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            items={[
              {
                key: "library",
                label: "资料来源",
                children: item.librarySource
                  ? `${item.librarySource.code} v${item.librarySource.version}；保留选用时的资料`
                  : "旧模型自有资料，原样保留；调整时请从公共库更换",
              },
              {
                key: "specModel",
                label: "规格型号",
                children: display(item.specModel),
              },
              {
                key: "manufacturer",
                label: "生产厂家",
                children: display(item.manufacturer),
              },
              {
                key: "factorSource",
                label: "因子来源",
                children: display(item.factorSource),
              },
              {
                key: "dataSource",
                label: "数据来源",
                children: display(item.dataSource),
              },
            ]}
          />
        ),
      }}
      columns={[
        { title: "数据名称", dataIndex: "dataName", width: 180 },
        {
          title: "来源版本",
          width: 190,
          render: (_: unknown, item: ModelItem) =>
            item.librarySource ? (
              <Typography.Text>
                {item.librarySource.code} v{item.librarySource.version}
              </Typography.Text>
            ) : (
              <Tag color="orange">旧模型自有数据</Tag>
            ),
        },
        {
          title: "活动数据单位",
          dataIndex: "functionalUnit",
          width: 130,
          render: (value: string) =>
            isKnownUnit(value) ? unitSymbol(value) : value,
        },
        {
          title: "碳足迹因子",
          dataIndex: "carbonFootprintFactor",
          width: 160,
          render: display,
        },
        {
          title: "排放因子",
          dataIndex: "emissionFactor",
          width: 160,
          render: (value: string, item: ModelItem) =>
            value && isNumericFactor(value) && isKnownUnit(item.functionalUnit)
              ? `${value} ${factorUnitLabel(item.functionalUnit)}`
              : display(value),
        },
        ...(!readOnly
          ? [
              {
                title: "操作",
                key: "actions",
                width: 220,
                render: (_: unknown, _item: ModelItem, index: number) => (
                  <Space size={0}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => onReplace(index)}
                    >
                      更换
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      disabled={index === 0}
                      onClick={() => onMove(index, -1)}
                    >
                      上移
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      disabled={index === items.length - 1}
                      onClick={() => onMove(index, 1)}
                    >
                      下移
                    </Button>
                    <Popconfirm
                      title="从当前模型移除这个数据项？"
                      onConfirm={() => onDelete(index)}
                    >
                      <Button type="link" size="small" danger>
                        移除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
