"use client";
import { useState } from "react";
import { Button, Card, Descriptions, Table, Tag, Typography } from "antd";
import { ACCOUNTING_STAGE_LABELS } from "@/shared/accounting";
import type { RunView } from "./types";
import { runTraceRows } from "./run-trace";
import { RunSnapshotDrawer } from "./run-snapshot-drawer";
export function RunResults({
  run,
  currentInputRevision,
  historical = false,
}: {
  run: RunView | null;
  currentInputRevision: number;
  historical?: boolean;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  if (!run)
    return (
      <Card size="small">
        <Typography.Text type="secondary">
          保存输入后运行计算，可在这里查看结果和固定快照。
        </Typography.Text>
      </Card>
    );
  const result = run.result;
  const display = result.display;
  const number = (value: string, below: boolean, precision: string) =>
    below ? "< " + precision : value;
  return (
    <Card
      size="small"
      title="计算结果"
      extra={
        <>
          <Tag color={run.mode === "TRIAL" ? "orange" : "green"}>
            {run.mode === "TRIAL" ? "试算" : "正式"}
          </Tag>
          {historical && <Tag color="blue">历史修订</Tag>}
          {!historical && run.inputRevision !== currentInputRevision && (
            <Tag color="red">输入已变化，需重算</Tag>
          )}
        </>
      }
    >
      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2, md: 3 }}
        items={[
          { key: "engine", label: "引擎版本", children: run.engineVersion },
          {
            key: "energy",
            label: "上网电量",
            children:
              number(
                display.gridEnergyKwh,
                display.energyBelowDisplayPrecision,
                "0.01",
              ) + " kWh",
          },
          {
            key: "emissions",
            label: "排放总量",
            children:
              number(
                display.totalEmissionsKg,
                display.totalBelowDisplayPrecision,
                "0.01",
              ) + " kgCO₂e",
          },
          {
            key: "footprint",
            label: "每度电足迹",
            children:
              number(
                display.footprintKgPerKwh,
                display.belowDisplayPrecision,
                "0.000001",
              ) + " kgCO₂e/kWh",
          },
          {
            key: "delivered",
            label: "交付电量（足迹分母）",
            children: result.deliveredEnergyKwh + " kWh",
          },
          {
            key: "snapshot",
            label: "固定来源",
            children: (
              <Button
                type="link"
                className="!h-auto !p-0"
                onClick={() => setSourceOpen(true)}
              >
                查看模型、规则、因子和证据
              </Button>
            ),
          },
          {
            key: "hash",
            label: "输入摘要",
            span: 3,
            children: (
              <Typography.Text copyable className="break-all text-xs">
                {run.inputHash}
              </Typography.Text>
            ),
          },
        ]}
      />
      <Table
        size="small"
        pagination={false}
        rowKey="stage"
        dataSource={Object.entries(ACCOUNTING_STAGE_LABELS).map(
          ([stage, name]) => ({
            stage,
            name,
            value: display.stagesKg[stage as keyof typeof display.stagesKg],
          }),
        )}
        columns={[
          { title: "阶段", dataIndex: "name" },
          { title: "排放量 (kgCO₂e)", dataIndex: "value" },
        ]}
      />
      <Typography.Title level={5} className="!mt-4">
        逐项结果
      </Typography.Title>
      <Table
        size="small"
        rowKey="itemId"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1150 }}
        dataSource={runTraceRows(run)}
        expandable={{
          expandedRowRender: (row) => (
            <Typography.Paragraph className="!mb-0">
              单位换算：{row.conversions}
            </Typography.Paragraph>
          ),
        }}
        columns={[
          { title: "阶段", dataIndex: "stage", width: 120 },
          { title: "数据项", dataIndex: "name", width: 190 },
          { title: "原始活动量", dataIndex: "original", width: 190 },
          { title: "归一活动量", dataIndex: "normalized", width: 140 },
          { title: "因子版本与数值", dataIndex: "factor", width: 290 },
          { title: "排放量 (kgCO₂e)", dataIndex: "emissions", width: 150 },
        ]}
      />
      <RunSnapshotDrawer
        run={run}
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
      />
    </Card>
  );
}
