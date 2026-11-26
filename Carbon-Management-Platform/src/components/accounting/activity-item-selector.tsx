"use client";

import { useEffect, useRef } from "react";
import { Menu, Select, Typography } from "antd";
import type { ModelRow } from "@/domain/calculation/model-rows";

export function ActivityItemSelector({
  rows,
  selectedId,
  onSelect,
}: {
  rows: readonly ModelRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = list.current;
    const selected = container?.querySelector('[aria-current="true"]');
    if (!container || !selected) return;

    const { top, bottom } = container.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.top < top) container.scrollTop += item.top - top;
    else if (item.bottom > bottom) container.scrollTop += item.bottom - bottom;
  }, [selectedId]);

  return (
    <div className="min-w-0 lg:relative">
      <Select
        aria-label="活动项"
        className="w-full lg:!hidden"
        disabled={false}
        value={selectedId}
        options={rows.map((row) => ({ value: row.id, label: row.name }))}
        onChange={onSelect}
        showSearch={{ optionFilterProp: "label" }}
        optionRender={(option) => (
          <span className="whitespace-normal wrap-anywhere">
            {option.label}
          </span>
        )}
      />
      {/* Let the adjacent form set the row height, even when the list overflows. */}
      <div className="absolute inset-0 hidden flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 lg:flex">
        <Typography.Text
          type="secondary"
          className="block shrink-0 border-b border-slate-200 px-3 py-2 text-xs"
        >
          活动项
        </Typography.Text>
        <div
          ref={list}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <Menu
            aria-label="活动项"
            mode="inline"
            classNames={{
              root: "!border-0 !bg-transparent py-1",
              item: "!h-auto min-h-9 !px-3 py-2 !leading-5",
              itemContent: "!whitespace-normal wrap-anywhere",
            }}
            selectedKeys={[selectedId]}
            items={rows.map((row) => ({
              key: row.id,
              label: row.name,
              "aria-current": row.id === selectedId ? true : undefined,
            }))}
            onSelect={({ key }) => onSelect(key)}
          />
        </div>
      </div>
    </div>
  );
}
