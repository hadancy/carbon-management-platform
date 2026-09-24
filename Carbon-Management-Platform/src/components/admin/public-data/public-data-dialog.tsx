import { Alert, Col, Form, Input, Modal, Row, Select } from "antd";
import type { FormInstance } from "antd";
import type { PublicDataForm } from "./types";
import { typeLabels } from "./types";

type Props = {
  editingId: string | null;
  modalOpen: boolean;
  closeModal: () => void;
  form: FormInstance<PublicDataForm>;
  save: (values: PublicDataForm) => Promise<void>;
  busy: boolean;
  error: string;
};

export function PublicDataDialog({
  editingId,
  modalOpen,
  closeModal,
  form,
  save,
  busy,
  error,
}: Props) {
  return (
    <Modal
      title={editingId ? "编辑公共数据草稿" : "新增公共数据"}
      open={modalOpen}
      onCancel={closeModal}
      onOk={() => form.submit()}
      confirmLoading={busy}
      okText="保存草稿"
      cancelText="取消"
      width={700}
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
        <Form.Item label="来源（因子与规则必填）" name="source">
          <Input placeholder="标准编号、数据源、适用范围与日期" />
        </Form.Item>
        <Form.Item
          label="结构化内容（JSON 对象）"
          name="contentText"
          rules={[{ required: true }]}
        >
          <Input.TextArea rows={7} placeholder={'{"description":"资料说明"}'} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
