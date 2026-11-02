"use client";
import { useEffect } from "react";
import { Alert, Form, Input, Modal, Select } from "antd";
import type { ApprovedRunOption, ReportTemplateOption } from "./types";

export type CreateReportValues = {
  code: string;
  calculationRunId: string;
  templateVersionId?: string;
};
type Values = CreateReportValues;
export function CreateReportDialog({
  open,
  busy,
  runs,
  templates,
  initialRunId,
  onCancel,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  runs: ApprovedRunOption[];
  templates: ReportTemplateOption[];
  initialRunId?: string;
  onCancel: () => void;
  onCreate: (values: Values) => Promise<void>;
}) {
  const [form] = Form.useForm<Values>();
  useEffect(() => {
    if (!open) return;
    const run = runs.find((entry) => entry.id === initialRunId) ?? runs[0];
    form.setFieldsValue({
      calculationRunId: run?.id,
      templateVersionId: undefined,
      code: run ? "RPT_" + run.caseCode.slice(0, 50) + "_" + Date.now() : "",
    });
  }, [open, initialRunId, runs, form]);
  async function submit() {
    try {
      const values = await form.validateFields();
      await onCreate(values);
    } catch {
      /* Field errors and request feedback are handled by their owners. */
    }
  }
  return (
    <Modal
      title="从已审核运行生成报告"
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText="生成报告草稿"
      cancelText="取消"
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="报告绑定所选运行。后续核算改动不会改写这份报告的数值。"
        className="!mb-4"
      />
      <Form form={form} layout="vertical" disabled={busy}>
        <Form.Item
          label="报告编号"
          name="code"
          rules={[
            { required: true, message: "请填写报告编号" },
            {
              pattern: /^[A-Za-z0-9_-]{2,80}$/,
              message: "请输入 2～80 位字母、数字、下划线或连字符",
            },
          ]}
        >
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item
          label="核算审核通过的运行"
          name="calculationRunId"
          rules={[{ required: true, message: "请选择已审核运行" }]}
        >
          <Select
            showSearch={{ optionFilterProp: "label" }}
            options={runs.map((run) => ({
              value: run.id,
              label:
                run.caseCode + " · v" + run.revisionNo + " · " + run.product,
            }))}
          />
        </Form.Item>
        <Form.Item name="templateVersionId" label="报告模板（创建后固定）">
          <Select
            allowClear
            placeholder="内置并网光伏模板"
            options={templates.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
