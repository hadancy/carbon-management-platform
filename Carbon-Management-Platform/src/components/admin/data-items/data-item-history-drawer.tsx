"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Table, Typography } from "antd";
import {
  formatDataItemEmissionFactor,
  type AdminDataItemEntry,
  type AdminDataItemGroup,
  type AdminDataItemHistory,
} from "@/shared/data-items";
import { formatBeijingTime } from "@/shared/beijing-time";
import { DataItemDetails } from "./data-item-details";
import {
  DataItemVersionActions,
  type DataItemVersionHandlers,
} from "./data-item-version-actions";

export function DataItemHistoryDrawer({
  group,
  actions,
  busy,
  revision,
  onClose,
}: {
  group: AdminDataItemGroup;
  actions: DataItemVersionHandlers;
  busy: boolean;
  revision: number;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<AdminDataItemEntry | null>(null);
  const query = new URLSearchParams({
    dataItemId: group.id,
    page: String(page),
    pageSize: String(pageSize),
  }).toString();
  const requestKey = `${query}:${revision}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    history?: AdminDataItemHistory;
    error?: string;
  }>();
  const current = result?.key === requestKey ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      try {
        const response = await fetch(`/api/admin/data-items/history?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "历史版本加载失败");
        if (!controller.signal.aborted)
          setResult({ key: requestKey, history: data });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            error: cause instanceof Error ? cause.message : "历史版本加载失败",
          });
      }
    }
    void loadHistory();
    return () => controller.abort();
  }, [query, requestKey]);

  const name =
    group.current?.dataName ??
    group.draft?.dataName ??
    group.latestRetired?.dataName;
  const history = current?.history;
  return (
    <Drawer
      open
      title={name ? `${name} · 历史版本` : "历史版本"}
      size={900}
      onClose={onClose}
    >
      <Typography.Paragraph type="secondary" className="mb-4 break-all text-xs">
        {group.code}
      </Typography.Paragraph>
      {current?.error && (
        <Alert
          type="error"
          title={current.error}
          className="mb-4"
          action={
            <Button size="small" onClick={() => setAttempt(attempt + 1)}>
              重试
            </Button>
          }
        />
      )}
      <Table<AdminDataItemEntry>
        size="small"
        rowKey="id"
        loading={!current}
        dataSource={history?.entries ?? []}
        locale={{
          emptyText: current?.error ? "请重试加载历史版本" : "暂无历史版本",
        }}
        scroll={{ x: 790 }}
        pagination={
          history?.total
            ? {
                current: history.page,
                pageSize,
                total: history.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (total) => `共 ${total} 个历史版本`,
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPageSize === pageSize ? nextPage : 1);
                  setPageSize(nextPageSize);
                },
              }
            : false
        }
        columns={[
          {
            title: "版本",
            width: 70,
            dataIndex: "version",
            render: (version: number) => `v${version}`,
          },
          {
            title: "排放因子",
            width: 130,
            render: (_, entry) => formatDataItemEmissionFactor(entry),
          },
          {
            title: "停用时间",
            dataIndex: "retiredAt",
            width: 140,
            render: (date: string | null) =>
              date ? formatBeijingTime(date, "minute") : "—",
          },
          {
            title: "停用原因",
            dataIndex: "retirementReason",
            width: 175,
            render: (reason: string | null) => (
              <Typography.Text ellipsis={{ tooltip: reason }} className="block">
                {reason || "—"}
              </Typography.Text>
            ),
          },
          {
            title: "引用记录",
            dataIndex: "referenceCount",
            width: 105,
            render: (count: number) =>
              count ? `${count} 个模型版本` : "从未引用",
          },
          {
            title: "操作",
            width: 170,
            render: (_, entry) => (
              <DataItemVersionActions
                entry={entry}
                actions={{ ...actions, onView: setDetail }}
                busy={busy}
                hasDraft={!!group.draft}
              />
            ),
          },
        ]}
      />
      {detail && (
        <DataItemDetails entry={detail} onClose={() => setDetail(null)} />
      )}
    </Drawer>
  );
}
