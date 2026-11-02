"use client";

import { useEffect } from "react";
import { Alert, Form, Input, Modal, Select } from "antd";

export type CreateModelValues = {
  code: string;
  name: string;
  sourceVersionId?: string;
};

export function ModelCreateDialog({
  scope,
  open,
  sourceVersionId,
  templateOptions,
  busy,
  error,
  onCancel,
  onCreate,
}: {
  scope: "SCHOOL" | "PUBLIC";
  open: boolean;
  sourceVersionId?: string;
  templateOptions: { value: string; label: string }[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onCreate: (values: CreateModelValues) => void;
}) {
  const [form] = Form.useForm<CreateModelValues>();
  const selectedSourceVersionId = Form.useWatch("sourceVersionId", form);

  useEffect(() => {
    if (open) form.setFieldsValue({ code: "", name: "", sourceVersionId });
  }, [form, open, sourceVersionId]);

  return (
    <Modal
      title={scope === "PUBLIC" ? "新建公用模型模板" : "新建本校模型"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="创建草稿"
      confirmLoading={busy}
      destroyOnHidden
    >
      {error && <Alert type="error" title={error} className="mb-4" />}
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item
          name="code"
          label="模型编码"
          rules={[
            { required: true, message: "请输入模型编码" },
            {
              pattern: /^[A-Za-z0-9_-]{2,80}$/,
              message: "使用 2–80 位字母、数字、下划线或连字符",
            },
          ]}
        >
          <Input maxLength={80} placeholder="如 PCM-001" />
        </Form.Item>
        {scope === "SCHOOL" && (
          <Form.Item name="sourceVersionId" label="引用公用模板（可选）">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={templateOptions}
              placeholder="不引用，创建空白模型"
            />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label={
            scope === "PUBLIC"
              ? "模板名称"
              : "模型名称（引用模板时沿用模板名称）"
          }
        >
          <Input
            maxLength={200}
            placeholder="可创建后补充"
            disabled={Boolean(selectedSourceVersionId)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
