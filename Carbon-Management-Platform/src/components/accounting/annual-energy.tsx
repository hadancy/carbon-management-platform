"use client";
import { useState } from "react";
import { App, Button, Card, Form, Space, Table, Typography } from "antd";
import { sumAnnualEnergy } from "@/domain/calculation/energy";
import { AnnualEnergyRowDialog } from "./annual-energy-row-dialog";
import { AnnualEnergyTools } from "./annual-energy-tools";
import { yearPeriod, type EnergyRow } from "./annual-energy-data";
function AnnualEnergyTable({
  value = [],
  onChange,
  years,
  disabled,
  id,
}: {
  value?: EnergyRow[];
  onChange?: (rows: EnergyRow[]) => void;
  years: number;
  disabled: boolean;
  id?: string;
}) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<{
    index: number;
    row: EnergyRow;
  } | null>(null);
  const nextYear = () =>
    Array.from({ length: years }, (_, i) => i + 1).find(
      (year) => !value.some((row) => row.operatingYear === year),
    );
  const sorted = value
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => a.operatingYear - b.operatingYear);
  function copy(row: EnergyRow) {
    try {
      const year = nextYear();
      if (!year) throw Error("运行年度已齐全");
      const first = value.find((row) => row.operatingYear === 1)?.periodStart;
      if (!first) throw Error("请先填写第 1 年期间");
      setEditing({
        index: -1,
        row: { ...row, operatingYear: year, ...yearPeriod(first, year - 1) },
      });
    } catch (error) {
      message.warning((error as Error).message);
    }
  }
  return (
    <div id={id}>
      <AnnualEnergyTools
        rows={value}
        years={years}
        disabled={disabled}
        onChange={onChange ?? (() => {})}
        onAdd={() => {
          const year = nextYear();
          if (year)
            setEditing({
              index: -1,
              row: {
                operatingYear: year,
                periodStart: "",
                periodEnd: "",
                source: "ACTUAL",
                value: "",
                unit: "kWh",
                evidence: "",
                method: "",
                evidenceAssetIds: [],
              },
            });
        }}
      />
      <Table
        size="small"
        rowKey="index"
        dataSource={sorted}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `${total} 个年度 / 设计 ${years} 年`,
        }}
        scroll={{ x: 850 }}
        columns={[
          { title: "运行年", dataIndex: "operatingYear", width: 80 },
          {
            title: "期间",
            render: (_, row) =>
              `${row.periodStart || "未填"} ～ ${row.periodEnd || "未填"}`,
          },
          {
            title: "电量",
            render: (_, row) => `${row.value || "未填"} ${row.unit}`,
          },
          {
            title: "来源",
            render: (_, row) => (row.source === "ACTUAL" ? "实测" : "估算"),
          },
          {
            title: "凭证 / 方法",
            render: (_, row) => (
              <div className="max-w-64">
                <Typography.Paragraph
                  ellipsis={{ rows: 2, tooltip: true }}
                  className="!mb-0"
                >
                  {row.evidence || "未填凭证"}
                  {row.source === "ESTIMATED"
                    ? ` · ${row.method || "未填方法"}`
                    : ""}
                </Typography.Paragraph>
                {row.evidenceAssetIds.length > 0 && (
                  <Typography.Text type="secondary">
                    {row.evidenceAssetIds.length} 个附件
                  </Typography.Text>
                )}
              </div>
            ),
          },
          ...(!disabled
            ? [
                {
                  title: "操作",
                  width: 180,
                  render: (_: unknown, row: EnergyRow & { index: number }) => (
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => setEditing({ index: row.index, row })}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        disabled={value.length >= years}
                        onClick={() => copy(row)}
                      >
                        复制
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() =>
                          onChange?.(
                            value.filter((_, index) => index !== row.index),
                          )
                        }
                      >
                        移除
                      </Button>
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />
      <AnnualEnergyRowDialog
        row={editing?.row ?? null}
        years={years}
        onCancel={() => setEditing(null)}
        onSave={(row) => {
          if (
            value.some(
              (item, index) =>
                item.operatingYear === row.operatingYear &&
                index !== editing?.index,
            )
          ) {
            message.error("该运行年度已存在");
            return;
          }
          onChange?.(
            editing?.index === -1
              ? [...value, row]
              : value.map((item, index) =>
                  index === editing?.index ? row : item,
                ),
          );
          setEditing(null);
        }}
      />
    </div>
  );
}
export function AnnualEnergyEditor({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: () => void;
}) {
  const form = Form.useFormInstance();
  const years = Form.useWatch("operatingYears", form) ?? 1;
  return (
    <Card
      title="运行年度电量"
      size="small"
      extra={
        <Typography.Text type="secondary">每个运行年度一条</Typography.Text>
      }
    >
      <Form.Item
        name="annualEnergy"
        rules={[
          {
            validator: (_, rows: EnergyRow[] | undefined) => {
              const problems = sumAnnualEnergy(years, rows ?? []).problems;
              return problems.length
                ? Promise.reject(
                    Error(
                      problems
                        .slice(0, 3)
                        .map((problem) => problem.message)
                        .join("；"),
                    ),
                  )
                : Promise.resolve();
            },
          },
        ]}
      >
        <AnnualEnergyTable
          years={years}
          disabled={disabled}
          onChange={() => onChange()}
        />
      </Form.Item>
    </Card>
  );
}
