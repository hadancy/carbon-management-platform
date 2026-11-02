"use client";

import {
  Button,
  Empty,
  Grid,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type {
  AdminDataItemEntry,
  AdminDataItemList,
} from "@/shared/data-items";
import { factorUnitLabel, unitSymbol } from "@/shared/units";

export function DataItemTable({
  entries,
  total,
  query,
  loading,
  busy,
  onPage,
  onView,
  onEdit,
  onPublish,
  onNewVersion,
  onRetire,
  onDelete,
}: AdminDataItemList & {
  loading: boolean;
  busy: boolean;
  onPage: (page: number, pageSize: number) => void;
  onView: (entry: AdminDataItemEntry) => void;
  onEdit: (entry: AdminDataItemEntry) => void;
  onPublish: (entry: AdminDataItemEntry) => void;
  onNewVersion: (entry: AdminDataItemEntry) => void;
  onRetire: (entry: AdminDataItemEntry) => void;
  onDelete: (entry: AdminDataItemEntry) => void;
}) {
  const screens = Grid.useBreakpoint();
  return (
    <Table<AdminDataItemEntry>
      size="small"
      rowKey="id"
      dataSource={entries}
      loading={loading}
      scroll={{ x: 1454 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              query.q || query.status !== "ALL" || query.unit
                ? "没有符合筛选条件的数据项"
                : "暂无公共数据项，请先新增"
            }
          />
        ),
      }}
      pagination={{
        current: query.page,
        pageSize: query.pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        showTotal: (count) => `共 ${count} 个版本`,
        onChange: onPage,
      }}
      columns={[
        { title: "编码", dataIndex: "code", width: 150, ellipsis: true },
        {
          title: "版本",
          dataIndex: "version",
          width: 64,
          render: (version: number) => `v${version}`,
        },
        {
          title: "数据名称",
          dataIndex: "dataName",
          width: 170,
          ellipsis: true,
        },
        {
          title: "规格型号",
          dataIndex: "specModel",
          width: 140,
          ellipsis: true,
          render: (value: string) => value || "—",
        },
        {
          title: "生产厂家",
          dataIndex: "manufacturer",
          width: 150,
          ellipsis: true,
          render: (value: string) => value || "—",
        },
        {
          title: "活动单位",
          dataIndex: "functionalUnit",
          width: 100,
          render: (value: string) =>
            value ? (
              unitSymbol(value)
            ) : (
              <Typography.Text type="secondary">待填写</Typography.Text>
            ),
        },
        {
          title: "排放因子",
          width: 170,
          render: (_, entry) =>
            entry.emissionFactor
              ? `${entry.emissionFactor}${entry.functionalUnit ? ` ${factorUnitLabel(entry.functionalUnit)}` : "（单位待填写）"}`
              : "—",
        },
        {
          title: "引用记录",
          width: 110,
          render: (_, entry) =>
            entry.referenceCount ? (
              <Tooltip title="包含历史版本和已移除的引用">
                <Typography.Text>
                  {entry.referenceCount} 个模型版本
                </Typography.Text>
              </Tooltip>
            ) : (
              <Typography.Text type="secondary">从未引用</Typography.Text>
            ),
        },
        {
          title: "状态",
          fixed: screens.md ? "right" : undefined,
          width: 90,
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
          fixed: screens.md ? "right" : undefined,
          width: 310,
          render: (_, entry) => (
            <Space size={0} wrap>
              <Button
                type="link"
                size="small"
                disabled={busy}
                onClick={() => onView(entry)}
              >
                查看
              </Button>
              {entry.status === "DRAFT" ? (
                <>
                  <Button
                    type="link"
                    size="small"
                    disabled={busy}
                    onClick={() => onEdit(entry)}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    disabled={busy}
                    onClick={() => onPublish(entry)}
                  >
                    发布
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="link"
                    size="small"
                    disabled={busy}
                    onClick={() => onNewVersion(entry)}
                  >
                    创建新版本
                  </Button>
                  {!entry.retiredAt && (
                    <Button
                      type="link"
                      size="small"
                      danger
                      disabled={busy}
                      onClick={() => onRetire(entry)}
                    >
                      停用
                    </Button>
                  )}
                </>
              )}
              <Tooltip
                title={
                  entry.referenceCount > 0
                    ? "已被模型引用（含历史记录），只能停用"
                    : "删除当前版本"
                }
              >
                <span>
                  <Button
                    type="link"
                    size="small"
                    danger
                    disabled={busy || entry.referenceCount > 0}
                    onClick={() => onDelete(entry)}
                  >
                    删除
                  </Button>
                </span>
              </Tooltip>
            </Space>
          ),
        },
      ]}
    />
  );
}
