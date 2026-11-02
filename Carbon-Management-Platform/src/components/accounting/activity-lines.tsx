"use client";

import { Card, Form, Input, Select, Space, Typography } from "antd";
import { ACCOUNTING_STAGE_LABELS } from "@/shared/accounting";
import type { ModelContent } from "@/shared/models";
import type { FactorOption } from "./types";
import { EvidenceUpload } from "./evidence-upload";
import { compatibleUnitOptions, canConvertUnit } from "@/shared/units";
import { modelRows } from "./model-rows";

export function ActivityLines({
  content,
  factors,
  disabled,
}: {
  content: ModelContent;
  factors: FactorOption[];
  disabled: boolean;
}) {
  const rows = modelRows(content);
  const form = Form.useFormInstance();
  function requiredFor(
    index: number,
    label: string,
    state: "RECORDED" | "NOT_APPLICABLE" = "RECORDED",
  ) {
    return [
      {
        validator: async (_: unknown, value: unknown) => {
          if (
            form.getFieldValue(["lines", index, "state"]) === state &&
            (value === undefined ||
              value === null ||
              String(value).trim() === "")
          )
            throw new Error(`请填写${label}`);
        },
      },
    ];
  }
  return (
    <Card title="生命周期活动数据" size="small">
      <Typography.Paragraph type="secondary">
        模型内因子可直接用于试算；正式计算须选择已发布公用因子和上传凭证。每项均需录入或说明不适用。
      </Typography.Paragraph>
      {rows.map((row, index) => (
        <Card
          key={row.id}
          size="small"
          className="!mb-3"
          title={`${ACCOUNTING_STAGE_LABELS[row.stage as keyof typeof ACCOUNTING_STAGE_LABELS] ?? "未映射阶段"} · ${row.name}`}
          extra={
            <Typography.Text type="secondary">
              模型因子 {row.modelFactor || "未填"} kgCO₂e/{row.unit}
            </Typography.Text>
          }
        >
          <Form.Item name={["lines", index, "itemId"]} hidden>
            <Input />
          </Form.Item>
          <div className="grid grid-cols-1 gap-x-3 md:grid-cols-3">
            <Form.Item
              name={["lines", index, "state"]}
              label="数据状态"
              rules={[{ required: true, message: "请选择状态" }]}
            >
              <Select
                disabled={disabled}
                options={[
                  { value: "RECORDED", label: "已录入" },
                  { value: "NOT_APPLICABLE", label: "不适用" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name={["lines", index, "factorVersionId"]}
              label="公用因子版本"
              help="留空时试算使用模型内因子"
            >
              <Select
                allowClear
                disabled={disabled}
                options={factors
                  .filter(
                    (factor) =>
                      factor.stage === row.stage &&
                      factor.unit === row.unit &&
                      (factor.subject === "ALL" || factor.subject === row.name),
                  )
                  .map((factor) => ({
                    value: factor.id,
                    label: factor.label,
                  }))}
                showSearch
                optionFilterProp="label"
                placeholder="模型内因子"
              />
            </Form.Item>
            <Form.Item
              name={["lines", index, "activityDate"]}
              label="活动日期"
              rules={
                row.role === "GRID_FACTOR" ? [] : requiredFor(index, "活动日期")
              }
            >
              <Input disabled={disabled} placeholder="YYYY-MM-DD" />
            </Form.Item>
            {row.role === "TRANSPORT" ? (
              <>
                <Form.Item
                  name={["lines", index, "weight"]}
                  label="运输重量"
                  rules={requiredFor(index, "运输重量")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "weightUnit"]}
                  label="重量单位"
                  rules={requiredFor(index, "重量单位")}
                >
                  <Select
                    disabled={disabled}
                    options={["kg", "t"].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "distance"]}
                  label="运输距离"
                  rules={requiredFor(index, "运输距离")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "distanceUnit"]}
                  label="距离单位"
                  rules={requiredFor(index, "距离单位")}
                >
                  <Select
                    disabled={disabled}
                    options={["m", "km"].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </Form.Item>
              </>
            ) : row.role === "ACTIVITY" ? (
              <>
                <Form.Item
                  name={["lines", index, "value"]}
                  label="活动量"
                  rules={requiredFor(index, "活动量")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "unit"]}
                  label="活动单位"
                  rules={[
                    ...requiredFor(index, "活动单位"),
                    {
                      validator: async (_: unknown, value: string) => {
                        if (
                          form.getFieldValue(["lines", index, "state"]) ===
                            "RECORDED" &&
                          value &&
                          !canConvertUnit(value, row.unit)
                        )
                          throw new Error(`请选择可换算为 ${row.unit} 的单位`);
                      },
                    },
                  ]}
                >
                  <Select
                    disabled={disabled}
                    options={compatibleUnitOptions(row.unit)}
                    placeholder="请选择活动单位"
                    showSearch={{ optionFilterProp: "label" }}
                  />
                </Form.Item>
              </>
            ) : null}
            {row.role !== "GRID_FACTOR" && (
              <>
                <Form.Item
                  name={["lines", index, "location"]}
                  label="发生地点"
                  rules={requiredFor(index, "发生地点")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "process"]}
                  label="设备或工艺"
                  rules={requiredFor(index, "设备或工艺")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "measurementMethod"]}
                  label="计量方法"
                  rules={requiredFor(index, "计量方法")}
                >
                  <Input disabled={disabled} />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "sourceType"]}
                  label="数据类型"
                  rules={requiredFor(index, "数据类型")}
                >
                  <Select
                    disabled={disabled}
                    options={[
                      { value: "ACTUAL", label: "实测" },
                      { value: "ESTIMATED", label: "估算" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name={["lines", index, "estimationMethod"]}
                  label="估算方法"
                  rules={[
                    {
                      validator: async (_: unknown, value: unknown) => {
                        if (
                          form.getFieldValue(["lines", index, "state"]) ===
                            "RECORDED" &&
                          form.getFieldValue(["lines", index, "sourceType"]) ===
                            "ESTIMATED" &&
                          !String(value ?? "").trim()
                        )
                          throw new Error("请填写估算方法");
                      },
                    },
                  ]}
                >
                  <Input disabled={disabled} />
                </Form.Item>
              </>
            )}
            <Form.Item
              name={["lines", index, "evidence"]}
              label="凭证说明"
              rules={
                row.role === "GRID_FACTOR" ? [] : requiredFor(index, "凭证说明")
              }
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "reason"]}
              label="零值或不适用原因"
              rules={requiredFor(index, "不适用原因", "NOT_APPLICABLE")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "evidenceAssetIds"]}
              label="证据附件"
            >
              <EvidenceUpload disabled={disabled} />
            </Form.Item>
          </div>
        </Card>
      ))}
      {!rows.length && (
        <Space>
          <Typography.Text type="warning">
            所选模型没有光伏计算映射，请先发布带映射的新版本。
          </Typography.Text>
        </Space>
      )}
    </Card>
  );
}
