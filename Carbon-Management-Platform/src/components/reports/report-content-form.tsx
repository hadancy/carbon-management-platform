"use client";
import { Alert, Form, Input } from "antd";
import type { FormInstance } from "antd";
import { REPORT_CONTENT_FIELDS, type ReportContent } from "@/shared/reports";

export function ReportContentForm({
  form,
  content,
  editable,
  busy,
  onChange,
}: {
  form: FormInstance<ReportContent>;
  content: ReportContent;
  editable: boolean;
  busy: boolean;
  onChange: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        title={
          editable
            ? "说明文字可编辑；核算数值由固定运行带入。可以保存未完成草稿，提交时须补齐必填字段。"
            : "此修订只读。已提交的正文和数值保持冻结。"
        }
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={content}
        disabled={!editable || busy}
        onValuesChange={onChange}
      >
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          {REPORT_CONTENT_FIELDS.slice(0, 3).map((field) => (
            <Form.Item
              key={field.name}
              label={field.label}
              name={field.name}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "请填写" + field.label,
                },
                { max: field.max },
                ...(field.name === "reportingDate"
                  ? [
                      {
                        pattern: /^\d{4}-\d{2}-\d{2}$/,
                        message: "日期格式为 YYYY-MM-DD",
                      },
                    ]
                  : []),
              ]}
            >
              <Input
                maxLength={field.max}
                placeholder={
                  field.name === "reportingDate" ? "YYYY-MM-DD" : undefined
                }
              />
            </Form.Item>
          ))}
        </div>
        {REPORT_CONTENT_FIELDS.slice(3).map((field) => (
          <Form.Item
            key={field.name}
            label={field.label}
            name={field.name}
            rules={[
              {
                required: true,
                whitespace: true,
                message: "请填写" + field.label,
              },
              { max: field.max },
            ]}
          >
            <Input.TextArea rows={4} maxLength={field.max} showCount />
          </Form.Item>
        ))}
      </Form>
    </div>
  );
}
