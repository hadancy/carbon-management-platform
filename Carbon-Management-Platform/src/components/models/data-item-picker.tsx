"use client";

import { useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import type { DataItemCatalogQuery, DataItemEntry } from "@/shared/data-items";
import { useDataItemCatalog } from "./use-data-item-catalog";
import { DataItemPickerFilters } from "./data-item-picker-filters";
import { DataItemPickerTable } from "./data-item-picker-table";

export function DataItemPicker({
  replacing,
  excludedIds,
  limit,
  onCancel,
  onConfirm,
}: {
  replacing: boolean;
  excludedIds: string[];
  limit: number;
  onCancel: () => void;
  onConfirm: (entries: DataItemEntry[]) => void;
}) {
  const [query, setQuery] = useState<DataItemCatalogQuery>({
    q: "",
    unit: "",
    page: 1,
    pageSize: 10,
  });
  const [selected, setSelected] = useState<DataItemEntry[]>([]);
  const { data, loading, error, retry } = useDataItemCatalog(query);
  return (
    <Modal
      open
      title={replacing ? "更换公共数据项版本" : "从公共数据项库选择"}
      width={1080}
      okText={replacing ? "确认更换" : `添加所选数据项（${selected.length}）`}
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onConfirm(selected)}
      okButtonProps={{ disabled: loading || !!error || selected.length === 0 }}
      className="[&_.ant-modal-body]:max-h-[70vh] [&_.ant-modal-body]:overflow-y-auto"
    >
      <Typography.Paragraph type="secondary" className="text-xs">
        每个数据项仅展示当前可选的发布版本。展开可查看来源资料。同一大类内已选用的数据项不能重复添加。
      </Typography.Paragraph>
      <DataItemPickerFilters
        loading={loading}
        onSearch={(filters) =>
          setQuery((current) => ({ ...current, ...filters, page: 1 }))
        }
      />
      {error && (
        <Alert
          className="mb-3"
          type="error"
          title={error}
          action={
            <Button size="small" onClick={retry}>
              重试
            </Button>
          }
        />
      )}
      <DataItemPickerTable
        entries={data?.entries ?? []}
        total={data?.total ?? 0}
        query={data?.query ?? query}
        loading={loading}
        selected={selected}
        excludedIds={excludedIds}
        replacing={replacing}
        limit={limit}
        onSelect={setSelected}
        onPage={(page, pageSize) =>
          setQuery((current) => ({ ...current, page, pageSize }))
        }
      />
      <Space wrap className="mt-3">
        <Typography.Text>已选择 {selected.length} 个数据项</Typography.Text>
        {selected.length > 0 && (
          <Button type="link" size="small" onClick={() => setSelected([])}>
            清空选择
          </Button>
        )}
      </Space>
      {selected.length > 0 && (
        <Typography.Paragraph
          type="secondary"
          className="mb-0 max-h-16 overflow-auto text-xs"
        >
          {selected
            .map(
              (entry) => `${entry.dataName}（${entry.code} v${entry.version}）`,
            )
            .join("、")}
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
