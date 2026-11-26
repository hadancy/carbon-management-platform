"use client";
import { useEffect } from "react";
import { Form, Input, InputNumber, Modal, Select } from "antd";
import { convertUnit } from "@/domain/calculation/units";
import {
  AccountingDatePicker,
  isAccountingDate,
  normalizeAccountingDate,
  requiredAccountingDateRule,
} from "./accounting-date-picker";
import { yearPeriod, type EnergyRow } from "./annual-energy-data";
import { EvidenceUpload } from "./evidence-upload";

type AnnualEnergyFormValues = Omit<EnergyRow, "evidenceAssetIds"> & {
  evidenceAssetIds?: EnergyRow["evidenceAssetIds"];
};

function expectedPeriodEnd(start: unknown) {
  if (!isAccountingDate(start)) return null;
  try {
    return yearPeriod(start, 0).periodEnd;
  } catch {
    return null;
  }
}

export function AnnualEnergyRowDialog({
  row,
  years,
  focusField,
  onCancel,
  onSave,
}: {
  row: EnergyRow | null;
  years: number;
  focusField?: string;
  onCancel: () => void;
  onSave: (row: EnergyRow) => void;
}) {
  const [form] = Form.useForm<AnnualEnergyFormValues>();
  const source = Form.useWatch("source", form);
  useEffect(() => {
    if (row) {
      form.setFieldsValue({
        ...row,
        periodStart: normalizeAccountingDate(row.periodStart),
        periodEnd: normalizeAccountingDate(row.periodEnd),
      });
    }
  }, [row, form]);
  return (
    <Modal
      title="编辑运行年度"
      open={!!row}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="应用到草稿"
      destroyOnHidden
      afterOpenChange={(open) => {
        if (open && focusField)
          form.scrollToField(focusField, { focus: true, block: "center" });
      }}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onFinish={({ evidenceAssetIds, ...values }) =>
          onSave({ ...values, evidenceAssetIds: evidenceAssetIds ?? [] })
        }
      >
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="operatingYear"
            label="运行年序号"
            rules={[
              { required: true },
              {
                type: "number",
                min: 1,
                max: years,
                message: `运行年须在 1～${years} 之间`,
              },
            ]}
          >
            <InputNumber
              min={1}
              max={years}
              precision={0}
              className="!w-full"
            />
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ACTUAL", label: "实测" },
                { value: "ESTIMATED", label: "估算" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="periodStart"
            label="期间起始"
            rules={[
              requiredAccountingDateRule,
              {
                validator: async (_, date: unknown) => {
                  if (isAccountingDate(date)) yearPeriod(date, 0);
                },
              },
            ]}
          >
            <AccountingDatePicker
              onChange={(date) =>
                form.setFieldValue("periodEnd", expectedPeriodEnd(date) ?? "")
              }
            />
          </Form.Item>
          <Form.Item
            name="periodEnd"
            label="期间结束"
            dependencies={["periodStart"]}
            rules={[
              requiredAccountingDateRule,
              {
                validator: async (_, date: unknown) => {
                  const expected = expectedPeriodEnd(
                    form.getFieldValue("periodStart"),
                  );
                  if (isAccountingDate(date) && expected && date !== expected)
                    throw Error(`完整运行年度的结束日期应为 ${expected}`);
                },
              },
            ]}
          >
            <AccountingDatePicker />
          </Form.Item>
          <Form.Item
            name="value"
            label="上网电量"
            dependencies={["unit"]}
            rules={[
              { required: true },
              {
                validator: (_, value) =>
                  convertUnit(value, form.getFieldValue("unit"), "kWh")
                    ? Promise.resolve()
                    : Promise.reject(Error("请输入非负十进制电量")),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true }]}>
            <Select
              options={["kWh", "Wh", "MWh"].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="evidence"
          label="凭证说明"
          rules={[
            { required: true, whitespace: true, message: "请填写凭证说明" },
            { max: 200 },
          ]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          name="method"
          label="估算方法"
          rules={[
            {
              required: source === "ESTIMATED",
              whitespace: true,
              message: "估算年度须填写方法",
            },
            { max: 200 },
          ]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="evidenceAssetIds" label="证据附件">
          <EvidenceUpload />
        </Form.Item>
      </Form>
    </Modal>
  );
}
