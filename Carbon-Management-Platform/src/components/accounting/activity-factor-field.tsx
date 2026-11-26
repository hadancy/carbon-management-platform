"use client";

import { Form, Select, Tag, Typography } from "antd";
import {
  factorApplicabilityProblem,
  factorDateMatch,
  factorMatchesItem,
} from "@/domain/calculation/factor-selection";
import type { ModelRow } from "@/domain/calculation/model-rows";
import { isNumericFactor } from "@/shared/units";
import type { AccountingFormValues, FactorOption } from "./types";

const dateStatus = {
  MATCH: { color: "success", label: "日期匹配" },
  OUTSIDE: { color: "error", label: "日期超出适用期" },
  PENDING: { color: "default", label: "待选择核对日期" },
} as const;

export function ActivityFactorField({
  row,
  index,
  factors,
  region,
  technology,
  referenceDate,
  disabled,
}: {
  row: ModelRow;
  index: number;
  factors: FactorOption[];
  region: string;
  technology: string;
  referenceDate?: string;
  disabled: boolean;
}) {
  const form = Form.useFormInstance<AccountingFormValues>();
  const activityDate = Form.useWatch(["lines", index, "activityDate"], form);
  const selectedId = Form.useWatch(["lines", index, "factorVersionId"], form);
  const grid = row.role === "GRID_FACTOR";
  const date = grid ? referenceDate : activityDate;
  const item = { stage: row.stage, unit: row.unit, subject: row.name };
  const canUseModelFactor = isNumericFactor(row.modelFactor);
  const selected = factors.find((factor) => factor.id === selectedId);
  const options = factors
    .filter(
      (factor) => factor.id === selectedId || factorMatchesItem(factor, item),
    )
    .map((factor) => ({ value: factor.id, label: factor.label, factor }));

  function details(factor: FactorOption) {
    const { validFrom, validTo } = factor.applicability;
    const status = dateStatus[factorDateMatch(factor, date)];
    const problem = factorApplicabilityProblem(factor, {
      ...item,
      region,
      technology,
      referenceDate: date,
      mode: "TRIAL",
    });
    const scope =
      problem?.code === "FACTOR_SCOPE" || problem?.code === "FACTOR_MISMATCH";
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-normal">
        <Typography.Text type="secondary" className="text-xs">
          适用期 {validFrom} 至 {validTo}
        </Typography.Text>
        <Tag color={status.color} className="m-0">
          {status.label}
        </Tag>
        {scope && (
          <Typography.Text type="danger" className="text-xs">
            {problem?.message}
          </Typography.Text>
        )}
      </div>
    );
  }

  const prompt = canUseModelFactor
    ? "留空时使用模型内因子试算"
    : "模型内因子未配置，请选择公用因子";
  return (
    <Form.Item
      name={["lines", index, "factorVersionId"]}
      label="公用因子版本"
      extra={
        <div aria-live="polite" className="space-y-1">
          {grid && (
            <div>
              按核算参考日期核对{referenceDate ? `（${referenceDate}）` : ""}
            </div>
          )}
          {selected ? (
            details(selected)
          ) : selectedId ? (
            <Typography.Text type="danger">
              所选版本不可用，请重新选择
            </Typography.Text>
          ) : (
            prompt
          )}
        </div>
      }
    >
      <Select
        allowClear
        disabled={disabled}
        options={options}
        showSearch={{ optionFilterProp: "label" }}
        virtual={false}
        optionRender={(option) => (
          <div className="space-y-1 whitespace-normal">
            <div>{option.label}</div>
            {details(option.data.factor)}
          </div>
        )}
        labelRender={({ label }) => label ?? "不可用的公用因子"}
        placeholder={canUseModelFactor ? "模型内因子" : "请选择公用因子"}
        notFoundContent="暂无适用于该阶段、对象和单位的公用因子"
      />
    </Form.Item>
  );
}
