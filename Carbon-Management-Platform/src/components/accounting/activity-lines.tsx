"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Form, Space, Tabs, Typography } from "antd";
import type { ModelRow } from "@/domain/calculation/model-rows";
import { ACCOUNTING_STAGE_LABELS } from "@/shared/accounting";
import { ActivityItemForm } from "./activity-item-form";
import { ActivityItemSelector } from "./activity-item-selector";
import type { AccountingFormValues, FactorOption } from "./types";

type IndexedActivity = { row: ModelRow; index: number };

export function ActivityLines({
  rows,
  factors,
  disabled,
  selectedItemId,
  onSelectItem,
}: {
  rows: readonly ModelRow[];
  factors: FactorOption[];
  disabled: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}) {
  const form = Form.useFormInstance<AccountingFormValues>();
  const factorContext = Form.useWatch(
    (values: AccountingFormValues) => ({
      region: values.region,
      technology: values.technology,
      referenceDate: values.referenceDate,
    }),
    form,
  );
  const stages = new Map<string, IndexedActivity[]>();
  for (const [index, row] of rows.entries()) {
    const key = row.stage || "unmapped";
    const items = stages.get(key) ?? [];
    items.push({ row, index });
    stages.set(key, items);
  }
  const selected = rows.find((row) => row.id === selectedItemId) ?? rows[0];
  const activeStage = selected?.stage || "unmapped";

  return (
    <Card
      size="small"
      className="min-w-0"
      classNames={{ body: "!p-3 sm:!p-4" }}
    >
      {rows.length === 0 ? (
        <Typography.Text type="warning">
          所选模型没有光伏计算映射，请先发布带映射的新版本。
        </Typography.Text>
      ) : (
        <>
          <Typography.Paragraph type="secondary" className="!mb-3">
            试算可使用模型内因子。正式计算需选择已发布的公用因子并关联凭证。请逐项录入，或填写不适用原因。
          </Typography.Paragraph>
          <Tabs
            aria-label="生命周期阶段"
            activeKey={activeStage}
            type="card"
            size="small"
            onChange={(key) => {
              const first = stages.get(key)?.[0];
              if (first) onSelectItem(first.row.id);
            }}
            items={Array.from(stages, ([key, items]) => {
              const stage = items[0].row
                .stage as keyof typeof ACCOUNTING_STAGE_LABELS;
              return {
                key,
                forceRender: true,
                label: (
                  <>
                    {ACCOUNTING_STAGE_LABELS[stage] ?? "未映射阶段"}
                    <Typography.Text
                      type="secondary"
                      className="ml-2 text-xs tabular-nums"
                    >
                      {items.length} 项
                    </Typography.Text>
                  </>
                ),
                children: (
                  <ActivityStagePanel
                    items={items}
                    factors={factors}
                    factorContext={factorContext}
                    disabled={disabled}
                    selectedItemId={selectedItemId}
                    onSelectItem={onSelectItem}
                  />
                ),
              };
            })}
          />
        </>
      )}
    </Card>
  );
}

function ActivityStagePanel({
  items,
  factors,
  factorContext,
  disabled,
  selectedItemId,
  onSelectItem,
}: {
  items: IndexedActivity[];
  factors: FactorOption[];
  factorContext?: Pick<
    AccountingFormValues,
    "region" | "technology" | "referenceDate"
  >;
  disabled: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}) {
  const position = Math.max(
    0,
    items.findIndex(({ row }) => row.id === selectedItemId),
  );
  const activeRow = items[position].row;
  const previous = items[position - 1]?.row;
  const next = items[position + 1]?.row;
  const multiple = items.length > 1;

  return (
    <div
      className={
        multiple
          ? "grid min-w-0 gap-3 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]"
          : "min-w-0"
      }
    >
      {multiple && (
        <ActivityItemSelector
          rows={items.map(({ row }) => row)}
          selectedId={activeRow.id}
          onSelect={onSelectItem}
        />
      )}
      <Card size="small" className="@container min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <Typography.Title level={5} className="!m-0 wrap-anywhere">
              {activeRow.name}
            </Typography.Title>
            <Typography.Text type="secondary" className="wrap-anywhere">
              模型因子{" "}
              {activeRow.modelFactor
                ? `${activeRow.modelFactor} kgCO₂e/${activeRow.unit}`
                : "未填"}
            </Typography.Text>
          </div>
          {multiple && (
            <Space size={6}>
              <Button
                size="small"
                icon={<LeftOutlined aria-hidden="true" />}
                disabled={!previous}
                onClick={() => previous && onSelectItem(previous.id)}
              >
                上一项
              </Button>
              <Typography.Text
                type="secondary"
                className="whitespace-nowrap text-xs tabular-nums"
              >
                {position + 1} / {items.length}
              </Typography.Text>
              <Button
                size="small"
                icon={<RightOutlined aria-hidden="true" />}
                iconPlacement="end"
                disabled={!next}
                onClick={() => next && onSelectItem(next.id)}
              >
                下一项
              </Button>
            </Space>
          )}
        </div>
        {/* Keep inactive fields registered for cross-item validation and saving. */}
        {items.map(({ row, index }) => (
          <div key={row.id} hidden={row.id !== activeRow.id}>
            <ActivityItemForm
              row={row}
              index={index}
              factors={factors}
              factorContext={factorContext}
              disabled={disabled}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
