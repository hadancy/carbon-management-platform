"use client";

import { Card, Form, Input, InputNumber, Select, Typography } from "antd";
import {
  AccountingDatePicker,
  isAccountingDate,
  requiredAccountingDateRule,
} from "./accounting-date-picker";
import type { RuleOption } from "./types";

export function CaseMethodForm({
  rules,
  disabled,
}: {
  rules: RuleOption[];
  disabled: boolean;
}) {
  return (
    <Card size="small" title="案例基本信息与方法" className="!mb-4">
      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
        <Form.Item
          name="specification"
          label="产品规格"
          rules={[{ required: true, message: "请输入产品规格" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="measurementUnit"
          label="计量单位"
          rules={[{ required: true, message: "请选择计量单位" }]}
        >
          <Select options={[{ value: "kWh", label: "千瓦时 (kWh)" }]} />
        </Form.Item>
        <Form.Item
          name="projectLocation"
          label="项目地点"
          rules={[{ required: true, message: "请输入项目地点" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="collectionStart"
          label="采集开始日期"
          rules={[requiredAccountingDateRule]}
        >
          <AccountingDatePicker />
        </Form.Item>
        <Form.Item
          name="collectionEnd"
          label="采集结束日期"
          dependencies={["collectionStart"]}
          rules={[
            requiredAccountingDateRule,
            ({ getFieldValue }) => ({
              async validator(_, end: unknown) {
                const start = getFieldValue("collectionStart");
                if (
                  isAccountingDate(start) &&
                  isAccountingDate(end) &&
                  end < start
                )
                  throw new Error("采集结束日期须为开始日期当天或之后");
              },
            }),
          ]}
        >
          <AccountingDatePicker />
        </Form.Item>
        <Form.Item label="供电场景">
          <Typography.Text>并网上网（首版）</Typography.Text>
        </Form.Item>
        <Form.Item
          name="referenceDate"
          label="核算参考日期"
          rules={[requiredAccountingDateRule]}
        >
          <AccountingDatePicker />
        </Form.Item>
        <Form.Item
          name="region"
          label="地域"
          rules={[{ required: true, message: "请输入地域" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="technology"
          label="技术/设备类型"
          rules={[{ required: true, message: "请输入技术信息" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="operatingYears"
          label="运行年数"
          rules={[{ required: true, message: "请输入运行年数" }]}
        >
          <InputNumber min={1} max={100} precision={0} className="!w-full" />
        </Form.Item>
        <Form.Item
          name="lossRatio"
          label="线损比例（0～1）"
          rules={[{ required: true, message: "请输入比例" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="directSupplyKwh"
          label="直供电量 (kWh)"
          rules={[{ required: true, message: "并网场景填写 0" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="transmissionMethod"
          label="输配电方法"
          rules={[{ required: true, message: "请选择方法" }]}
        >
          <Select
            options={[
              { value: "GRID_FACTOR_FALLBACK", label: "电网因子简化法" },
              { value: "SF6_ACTUAL", label: "SF₆ 实测法（未启用）" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="transmissionFallbackReason"
          label="简化法使用理由"
          rules={[{ required: true, message: "请说明 SF₆ 数据难以取得的原因" }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="ruleVersionId" label="规则版本">
          <Select
            allowClear
            disabled={disabled}
            options={rules.map((rule) => ({
              value: rule.id,
              label: rule.label,
            }))}
            labelRender={({ label }) => label ?? "不可用的规则版本"}
            placeholder="正式计算需选择"
          />
        </Form.Item>
        <Form.Item
          name="boundaryNote"
          label="案例系统边界"
          rules={[{ required: true, message: "请说明案例系统边界" }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="exclusionNote"
          label="取舍与排除说明"
          rules={[{ required: true, message: "无排除项也请填写“无”" }]}
        >
          <Input.TextArea rows={2} placeholder="无排除项请填写“无”" />
        </Form.Item>
      </div>
    </Card>
  );
}
