"use client";

import { Form, Input, InputNumber, Select } from "antd";
import type { FormInstance } from "antd";
import type { ModelContent } from "@/shared/models";
import { canonicalUnitCode, isKnownUnit, unitOptions } from "@/shared/units";
import { ModelBasicDetails } from "./model-basic-details";

export function ModelBasicForm({
  form,
  content,
  onChange,
  readOnly,
}: {
  form: FormInstance<ModelContent>;
  content: ModelContent;
  onChange: (content: ModelContent) => void;
  readOnly: boolean;
}) {
  if (readOnly) return <ModelBasicDetails content={content} />;

  return (
    <Form<ModelContent>
      form={form}
      layout="vertical"
      initialValues={content}
      onValuesChange={(changed) => {
        const next = { ...content, ...changed };
        if ("boundary" in changed && !next.boundary) next.boundary = "";
        onChange(next);
      }}
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item
          name="name"
          label="模型名称"
          rules={[
            { required: true, whitespace: true, message: "请输入模型名称" },
          ]}
        >
          <Input disabled={readOnly} maxLength={200} />
        </Form.Item>
        <Form.Item
          name="functionalQuantity"
          label="功能单位数量"
          rules={[
            {
              validator: (_, value: number | null) =>
                value !== null && Number.isFinite(value) && value > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error("请输入大于 0 的数量")),
            },
          ]}
        >
          <InputNumber min={0} className="w-full" />
        </Form.Item>
        <Form.Item
          name="functionalUnit"
          label="功能单位"
          extra="暂无所需单位？请联系平台管理员申请新增；未确认单位不能发布。"
          rules={[
            { required: true, message: "请选择功能单位" },
            {
              validator: (_, value: string) =>
                isKnownUnit(canonicalUnitCode(value))
                  ? Promise.resolve()
                  : Promise.reject(new Error("请选择列表中的功能单位")),
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={unitOptions}
            placeholder="选择功能单位"
          />
        </Form.Item>
        <Form.Item name="functionalDescription" label="功能说明">
          <Input maxLength={120} placeholder="例如：上网电量" />
        </Form.Item>
        <Form.Item
          name="boundary"
          label="系统边界"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "请选择或输入系统边界",
            },
          ]}
        >
          <Select
            disabled={readOnly}
            showSearch
            allowClear
            placeholder="选择或输入系统边界"
            options={[
              { value: "从摇篮到大门", label: "从摇篮到大门" },
              { value: "从摇篮到坟墓", label: "从摇篮到坟墓" },
            ]}
            popupRender={(menu) => (
              <>
                {menu}
                <Input
                  placeholder="其他边界：输入后按 Enter"
                  maxLength={200}
                  onPressEnter={(event) => {
                    const value = event.currentTarget.value.trim();
                    form.setFieldValue("boundary", value);
                    void form
                      .validateFields(["boundary"])
                      .catch(() => undefined);
                    onChange({ ...content, boundary: value });
                    event.currentTarget.value = "";
                  }}
                />
              </>
            )}
          />
        </Form.Item>
        <Form.Item
          name="referenceStandard"
          label="引用标准"
          rules={[
            { required: true, whitespace: true, message: "请输入引用标准" },
          ]}
        >
          <Input disabled={readOnly} maxLength={500} />
        </Form.Item>
        <Form.Item name="description" label="说明">
          <Input.TextArea disabled={readOnly} maxLength={2000} rows={2} />
        </Form.Item>
      </div>
    </Form>
  );
}
