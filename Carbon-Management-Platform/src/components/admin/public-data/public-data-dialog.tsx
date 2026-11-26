import { Alert, Col, Form, Input, Modal, Row, Select } from "antd";
import type { FormInstance } from "antd";
import type { PublicDataForm } from "./types";
import { typeLabels } from "./types";
import { EmissionFactorFields } from "./emission-factor-fields";
import { ReportTemplateFields } from "./report-template-fields";
import { RuleConfigFields } from "./rule-config-fields";
import { LegacyFactorPreview } from "./legacy-factor-preview";

type Props = {
  editingId: string | null;
  copyingFactor: boolean;
  publishMode: boolean;
  modalOpen: boolean;
  closeModal: () => void;
  form: FormInstance<PublicDataForm>;
  save: (values: PublicDataForm) => Promise<void>;
  busy: boolean;
  error: string;
  legacyFactorContent: string | null;
};

export function PublicDataDialog({
  editingId,
  copyingFactor,
  publishMode,
  modalOpen,
  closeModal,
  form,
  save,
  busy,
  error,
  legacyFactorContent,
}: Props) {
  const type = Form.useWatch("type", form);
  const activityUnit = Form.useWatch("factorActivityUnit", form);
  return (
    <Modal
      title={
        publishMode
          ? "校验并发布公共数据"
          : editingId
            ? "编辑公共数据草稿"
            : copyingFactor
              ? "从旧因子创建新版本"
              : "新增公共数据"
      }
      open={modalOpen}
      onCancel={closeModal}
      onOk={() => form.submit()}
      confirmLoading={busy}
      okText={publishMode ? "校验并发布" : "保存草稿"}
      cancelText="取消"
      width={760}
      className="[&_.ant-modal-body]:max-h-[68vh] [&_.ant-modal-body]:overflow-y-auto [&_.ant-modal-body]:overflow-x-hidden"
    >
      {error && <Alert type="error" title={error} className="mb-4" />}
      <Form form={form} layout="vertical" onFinish={save}>
        <Row gutter={18}>
          <Col xs={24} md={12}>
            <Form.Item label="类型" name="type" rules={[{ required: true }]}>
              <Select
                disabled={!!editingId}
                options={Object.entries(typeLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="编码"
              name="code"
              rules={[{ required: true, min: 2 }]}
            >
              <Input disabled={!!editingId} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="版本" name="version" rules={[{ required: true }]}>
              <Input disabled={!!editingId} placeholder="例如 1.0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="标题"
              name="title"
              rules={[{ required: true, min: 2 }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="来源（因子与规则必填）"
          name="source"
          rules={[
            {
              required: publishMode && type !== "REPORT_TEMPLATE",
              whitespace: true,
            },
          ]}
        >
          <Input placeholder="标准编号、数据源、适用范围与日期" />
        </Form.Item>
        {type === "EMISSION_FACTOR" ? (
          <>
            {legacyFactorContent && (
              <LegacyFactorPreview content={legacyFactorContent} />
            )}
            <EmissionFactorFields
              activityUnit={activityUnit}
              publishMode={publishMode}
            />
          </>
        ) : type === "RULE_CONFIG" ? (
          <RuleConfigFields publishMode={publishMode} />
        ) : (
          <ReportTemplateFields publishMode={publishMode} />
        )}
      </Form>
    </Modal>
  );
}
