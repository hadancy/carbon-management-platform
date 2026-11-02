import Link from "next/link";
import { Form, Input, Modal, Select } from "antd";
import type { ModelOption } from "./types";
export type CreateCaseValues = {
  code: string;
  product: string;
  modelVersionId: string;
};
export function CreateCaseDialog({
  open,
  busy,
  models,
  onCancel,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  models: ModelOption[];
  onCancel: () => void;
  onCreate: (values: CreateCaseValues) => Promise<void>;
}) {
  const [form] = Form.useForm<CreateCaseValues>();
  return (
    <Modal
      title="新建核算案例"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="创建"
      confirmLoading={busy}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onFinish={onCreate}
        className="mt-4"
      >
        <Form.Item
          name="code"
          label="案例编码"
          rules={[
            { required: true, message: "请输入案例编码" },
            {
              pattern: /^[A-Za-z0-9_-]{2,80}$/,
              message: "使用 2～80 位字母、数字、- 或 _",
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="product"
          label="产品或项目名称"
          rules={[{ required: true, whitespace: true, message: "请输入名称" }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          name="modelVersionId"
          label="已发布本校模型"
          rules={[{ required: true, message: "请选择模型版本" }]}
        >
          <Select
            options={models.map((model) => ({
              value: model.id,
              label: model.label,
            }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
      {!models.length && (
        <p>
          请先发布本校光伏模型。<Link href="/models">前往模型</Link>
        </p>
      )}
    </Modal>
  );
}
