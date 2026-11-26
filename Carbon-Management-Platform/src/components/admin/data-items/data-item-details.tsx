"use client";

import { formatBeijingTime } from "@/shared/beijing-time";
import { Alert, Descriptions, Drawer } from "antd";
import {
  formatDataItemEmissionFactor,
  type AdminDataItemEntry,
} from "@/shared/data-items";
import { unitSymbol } from "@/shared/units";

export function DataItemDetails({
  entry,
  onClose,
}: {
  entry: AdminDataItemEntry;
  onClose: () => void;
}) {
  return (
    <Drawer open title="公共数据项详情" size={620} onClose={onClose}>
      {entry.retiredAt && (
        <Alert
          className="mb-4"
          type="warning"
          title="该版本已停用"
          description={entry.retirementReason}
        />
      )}
      <Descriptions
        bordered
        column={1}
        size="small"
        className="[&_.ant-descriptions-item-content]:break-words"
        items={[
          { key: "code", label: "数据项编码", children: entry.code },
          { key: "version", label: "版本", children: `v${entry.version}` },
          {
            key: "status",
            label: "状态",
            children: entry.retiredAt
              ? "已停用"
              : entry.status === "PUBLISHED"
                ? "已发布"
                : "草稿",
          },
          { key: "name", label: "数据名称", children: entry.dataName },
          { key: "spec", label: "规格型号", children: entry.specModel || "—" },
          {
            key: "manufacturer",
            label: "生产厂家",
            children: entry.manufacturer || "—",
          },
          {
            key: "unit",
            label: "活动数据单位",
            children: entry.functionalUnit
              ? unitSymbol(entry.functionalUnit)
              : "待填写",
          },
          {
            key: "carbon",
            label: "原始碳足迹因子资料",
            children: entry.carbonFootprintFactor || "—",
          },
          {
            key: "factor",
            label: "排放因子",
            children: formatDataItemEmissionFactor(entry),
          },
          {
            key: "references",
            label: "引用记录",
            children: entry.referenceCount
              ? `${entry.referenceCount} 个模型版本（含历史引用）`
              : "从未引用",
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
          {
            key: "published",
            label: "发布时间（北京时间）",
            children: entry.publishedAt
              ? formatBeijingTime(entry.publishedAt)
              : "尚未发布",
          },
          {
            key: "retired",
            label: "停用时间（北京时间）",
            children: entry.retiredAt
              ? formatBeijingTime(entry.retiredAt)
              : "—",
          },
        ]}
      />
    </Drawer>
  );
}
