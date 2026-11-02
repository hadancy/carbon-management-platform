import { Alert, Form, Input, Select } from "antd";
import { REPORT_CONTENT_FIELDS } from "@/shared/reports";
import { TEMPLATE_TEXT_FIELDS } from "@/shared/report-template";
export function ReportTemplateFields({
  publishMode,
}: {
  publishMode: boolean;
}) {
  return (
    <>
      <Alert
        className="mb-4"
        type="info"
        showIcon
        title="并网光伏报告模板"
        description="配置标题与默认说明；数值、系统边界、结果表和版本追溯由核算快照生成。选择后模板固定到报告，后续发布新版本不会改写历史报告。"
      />
      <Form.Item
        name="templatePurpose"
        label="模板用途"
        rules={[{ required: publishMode }]}
      >
        <Select
          options={[
            { value: "TEST", label: "测试 / 演示" },
            { value: "PRODUCTION", label: "正式业务" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="templateApprovalReference"
        label="模板确认依据"
        rules={[{ required: publishMode, whitespace: true }, { max: 2000 }]}
      >
        <Input.TextArea rows={2} maxLength={2000} />
      </Form.Item>
      <Form.Item
        name="templateTitleSuffix"
        label="标题后缀（自动接在项目名后）"
        rules={[{ required: publishMode, whitespace: true }, { max: 80 }]}
        initialValue="碳足迹报告"
      >
        <Input maxLength={80} />
      </Form.Item>
      <Form.Item
        name="templatePreparedBy"
        label="默认编制机构（留空使用创建人）"
      >
        <Input maxLength={120} />
      </Form.Item>
      {TEMPLATE_TEXT_FIELDS.map((field) => {
        const definition = REPORT_CONTENT_FIELDS.find(
          (item) => item.name === field,
        )!;
        return (
          <Form.Item
            key={field}
            name={["templateDefaults", field]}
            label={`默认${definition.label}（留空使用内置内容）`}
            rules={[{ max: definition.max }]}
          >
            <Input.TextArea rows={3} maxLength={definition.max} />
          </Form.Item>
        );
      })}
    </>
  );
}
