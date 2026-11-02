import { Alert, Col, Form, Input, Row, Select } from "antd";
import { z } from "zod";

export function RuleConfigFields({ publishMode }: { publishMode: boolean }) {
  const required = [
    { required: publishMode, whitespace: true, message: "发布前须填写此项" },
  ];
  const dateRules = [
    ...required,
    {
      validator: (_: unknown, value: string) =>
        !value || z.iso.date().safeParse(value).success
          ? Promise.resolve()
          : Promise.reject(new Error("请输入有效日期 YYYY-MM-DD")),
    },
  ];
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="并网光伏五阶段规则"
        description="公式、产品和场景由当前计算方法固定；草稿可留空，发布前必须补齐全部规则字段。"
        className="mb-4"
      />
      <Row gutter={18}>
        <Col xs={24} md={12}>
          <Form.Item
            name="rulePurpose"
            label="规则用途"
            rules={[{ required: publishMode }]}
          >
            <Select
              options={[
                { value: "TEST", label: "测试" },
                { value: "PRODUCTION", label: "正式" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="计算方法">
            <Input value="并网光伏 · PV_GRID_V1" disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="ruleEffectiveFrom"
            label="适用开始日期"
            rules={dateRules}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="ruleEffectiveTo"
            label="适用结束日期"
            dependencies={["ruleEffectiveFrom"]}
            rules={[
              ...dateRules,
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value ||
                    !getFieldValue("ruleEffectiveFrom") ||
                    value >= getFieldValue("ruleEffectiveFrom")
                    ? Promise.resolve()
                    : Promise.reject(new Error("结束日期不得早于开始日期"));
                },
              }),
            ]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="ruleStandardReference"
        label="标准与公式引用"
        rules={required}
      >
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>
      <Form.Item
        name="ruleApprovalReference"
        label="方法确认与授权依据"
        rules={required}
      >
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>
    </>
  );
}
