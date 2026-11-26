"use client";

import { Form, Input, Select } from "antd";
import type { ModelRow } from "@/domain/calculation/model-rows";
import { compatibleUnitOptions, canConvertUnit } from "@/shared/units";
import { ActivityFactorField } from "./activity-factor-field";
import {
  AccountingDatePicker,
  requiredAccountingDateRule,
} from "./accounting-date-picker";
import { EvidenceUpload } from "./evidence-upload";
import type { AccountingFormValues, FactorOption } from "./types";

export function ActivityItemForm({
  row,
  index,
  factors,
  factorContext,
  disabled,
}: {
  row: ModelRow;
  index: number;
  factors: FactorOption[];
  factorContext?: Pick<
    AccountingFormValues,
    "region" | "technology" | "referenceDate"
  >;
  disabled: boolean;
}) {
  const form = Form.useFormInstance<AccountingFormValues>();

  function requiredFor(
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
    <>
      <Form.Item name={["lines", index, "itemId"]} hidden>
        <Input />
      </Form.Item>
      <div className="grid grid-cols-1 gap-x-4 @md:grid-cols-2 @2xl:grid-cols-3">
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
        <ActivityFactorField
          row={row}
          index={index}
          factors={factors}
          disabled={disabled}
          region={factorContext?.region ?? ""}
          technology={factorContext?.technology ?? ""}
          referenceDate={factorContext?.referenceDate}
        />
        <Form.Item
          name={["lines", index, "activityDate"]}
          label="活动日期"
          dependencies={[["lines", index, "state"]]}
          rules={
            row.role === "GRID_FACTOR"
              ? []
              : [
                  ({ getFieldValue }) =>
                    getFieldValue(["lines", index, "state"]) === "RECORDED"
                      ? requiredAccountingDateRule
                      : {},
                ]
          }
        >
          <AccountingDatePicker disabled={disabled} />
        </Form.Item>
        {row.role === "TRANSPORT" ? (
          <>
            <Form.Item
              name={["lines", index, "weight"]}
              label="运输重量"
              rules={requiredFor("运输重量")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "weightUnit"]}
              label="重量单位"
              rules={requiredFor("重量单位")}
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
              rules={requiredFor("运输距离")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "distanceUnit"]}
              label="距离单位"
              rules={requiredFor("距离单位")}
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
              rules={requiredFor("活动量")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "unit"]}
              label="活动单位"
              rules={[
                ...requiredFor("活动单位"),
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
              rules={requiredFor("发生地点")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "process"]}
              label="设备或工艺"
              rules={requiredFor("设备或工艺")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "measurementMethod"]}
              label="计量方法"
              rules={requiredFor("计量方法")}
            >
              <Input disabled={disabled} />
            </Form.Item>
            <Form.Item
              name={["lines", index, "sourceType"]}
              label="数据类型"
              rules={requiredFor("数据类型")}
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
          rules={row.role === "GRID_FACTOR" ? [] : requiredFor("凭证说明")}
        >
          <Input disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={["lines", index, "reason"]}
          label="零值或不适用原因"
          rules={requiredFor("不适用原因", "NOT_APPLICABLE")}
        >
          <Input disabled={disabled} />
        </Form.Item>
        <Form.Item name={["lines", index, "evidenceAssetIds"]} label="证据附件">
          <EvidenceUpload disabled={disabled} />
        </Form.Item>
      </div>
    </>
  );
}
