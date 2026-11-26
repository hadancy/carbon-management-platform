"use client";

import { Button, Empty, Grid, Table, Tag, Tooltip, Typography } from "antd";
import {
  formatDataItemEmissionFactor,
  type AdminDataItemGroup,
  type AdminDataItemGroups,
} from "@/shared/data-items";
import { unitSymbol } from "@/shared/units";
import {
  DataItemVersionActions,
  type DataItemVersionHandlers,
} from "./data-item-version-actions";

function displayVersion(group: AdminDataItemGroup) {
  return group.current ?? group.draft ?? group.latestRetired;
}

export function DataItemTable({
  groups,
  total,
  query,
  loading,
  busy,
  onPage,
  onHistory,
  actions,
}: AdminDataItemGroups & {
  loading: boolean;
  busy: boolean;
  onPage: (page: number, pageSize: number) => void;
  onHistory: (group: AdminDataItemGroup) => void;
  actions: DataItemVersionHandlers;
}) {
  const screens = Grid.useBreakpoint();
  return (
    <Table<AdminDataItemGroup>
      size="small"
      rowKey="id"
      dataSource={groups}
      loading={loading}
      scroll={{ x: 1260 }}
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
        showTotal: (count) => `共 ${count} 个数据项`,
        onChange: onPage,
      }}
      columns={[
        {
          title: "数据项",
          width: 250,
          render: (_, group) => {
            const name = displayVersion(group)?.dataName || "未命名数据项";
            return (
              <div>
                <Typography.Text
                  ellipsis={{ tooltip: name }}
                  className="block font-medium"
                >
                  {name}
                </Typography.Text>
                <Typography.Text
                  type="secondary"
                  ellipsis={{ tooltip: group.code }}
                  className="block text-xs"
                >
                  {group.code}
                </Typography.Text>
              </div>
            );
          },
        },
        {
          title: "规格及厂家",
          width: 184,
          render: (_, group) => {
            const entry = displayVersion(group);
            if (!entry?.specModel && !entry?.manufacturer) return "—";
            return (
              <div>
                {entry.specModel && (
                  <Typography.Text
                    ellipsis={{ tooltip: entry.specModel }}
                    className="block"
                  >
                    {entry.specModel}
                  </Typography.Text>
                )}
                {entry.manufacturer && (
                  <Typography.Text
                    type="secondary"
                    ellipsis={{ tooltip: entry.manufacturer }}
                    className="block text-xs"
                  >
                    {entry.manufacturer}
                  </Typography.Text>
                )}
              </div>
            );
          },
        },
        {
          title: "当前发布版",
          width: 113,
          render: (_, { current, historyCount }) =>
            current ? (
              <div className="space-y-0.5">
                <Tag color="green">v{current.version}</Tag>
                <Tooltip title="包含历史版本和已移除的引用">
                  <Typography.Text type="secondary" className="block text-xs">
                    {current.referenceCount
                      ? `${current.referenceCount} 个模型版本`
                      : "从未引用"}
                  </Typography.Text>
                </Tooltip>
              </div>
            ) : (
              <Typography.Text type="secondary">
                {historyCount ? "已停用" : "尚未发布"}
              </Typography.Text>
            ),
        },
        {
          title: "活动单位",
          width: 84,
          render: (_, { current }) =>
            current ? unitSymbol(current.functionalUnit) : "—",
        },
        {
          title: "排放因子",
          width: 138,
          render: (_, { current }) =>
            current ? formatDataItemEmissionFactor(current) : "—",
        },
        {
          title: "草稿",
          width: 165,
          render: (_, { draft }) =>
            draft ? (
              <div>
                <Tag color="blue">v{draft.version} 草稿</Tag>
                <DataItemVersionActions
                  entry={draft}
                  busy={busy}
                  actions={actions}
                />
              </div>
            ) : (
              "—"
            ),
        },
        {
          title: "历史版本",
          fixed: screens.md ? "right" : undefined,
          width: 108,
          render: (_, group) =>
            group.historyCount ? (
              <Button
                type="link"
                size="small"
                disabled={busy}
                onClick={() => onHistory(group)}
              >
                历史版本（{group.historyCount}）
              </Button>
            ) : (
              "—"
            ),
        },
        {
          title: "操作",
          fixed: screens.md ? "right" : undefined,
          width: 218,
          render: (_, { current, draft, latestRetired }) =>
            current ? (
              <DataItemVersionActions
                entry={current}
                busy={busy}
                actions={actions}
                hasDraft={!!draft}
              />
            ) : latestRetired ? (
              <Button
                type="link"
                size="small"
                disabled={busy}
                onClick={() => actions.onNewVersion(latestRetired)}
              >
                创建新版本
              </Button>
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}
