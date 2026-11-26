"use client";

import { Button, Space, Tooltip } from "antd";
import type { AdminDataItemEntry } from "@/shared/data-items";

export type DataItemVersionHandlers = {
  onView: (entry: AdminDataItemEntry) => void;
  onEdit: (entry: AdminDataItemEntry) => void;
  onPublish: (entry: AdminDataItemEntry) => void;
  onNewVersion: (entry: AdminDataItemEntry) => void;
  onRetire: (entry: AdminDataItemEntry) => void;
  onDelete: (entry: AdminDataItemEntry) => void;
};

export function DataItemVersionActions({
  entry,
  actions,
  busy,
  hasDraft = false,
}: {
  entry: AdminDataItemEntry;
  actions: DataItemVersionHandlers;
  busy: boolean;
  hasDraft?: boolean;
}) {
  const isDraft = entry.status === "DRAFT";
  return (
    <Space size={0} wrap>
      <Button
        type="link"
        size="small"
        aria-label={isDraft ? "查看草稿" : undefined}
        disabled={busy}
        onClick={() => actions.onView(entry)}
      >
        查看
      </Button>
      {isDraft ? (
        <>
          <Button
            type="link"
            size="small"
            disabled={busy}
            onClick={() => actions.onEdit(entry)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            disabled={busy}
            onClick={() => actions.onPublish(entry)}
          >
            发布
          </Button>
        </>
      ) : (
        <>
          <Tooltip title={hasDraft ? "已有草稿，可直接编辑" : undefined}>
            <span>
              <Button
                type="link"
                size="small"
                disabled={busy || hasDraft}
                onClick={() => actions.onNewVersion(entry)}
              >
                创建新版本
              </Button>
            </span>
          </Tooltip>
          {!entry.retiredAt && (
            <Button
              type="link"
              size="small"
              danger
              disabled={busy}
              onClick={() => actions.onRetire(entry)}
            >
              停用
            </Button>
          )}
        </>
      )}
      <Tooltip
        title={
          entry.referenceCount ? "已有引用记录，需保留该版本" : "删除该版本"
        }
      >
        <span>
          <Button
            type="link"
            size="small"
            danger
            aria-label={isDraft ? "删除草稿" : undefined}
            disabled={busy || entry.referenceCount > 0}
            onClick={() => actions.onDelete(entry)}
          >
            删除
          </Button>
        </span>
      </Tooltip>
    </Space>
  );
}
