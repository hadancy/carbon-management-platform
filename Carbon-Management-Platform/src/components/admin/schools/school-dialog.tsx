import { Alert, Form, Input, Modal } from "antd";
import type { FormInstance } from "antd";
import type { SchoolForm, SchoolRow } from "./types";

type Props = {
  selected: SchoolRow | null;
  modalOpen: boolean;
  close: () => void;
  form: FormInstance<SchoolForm>;
  save: (values: SchoolForm) => Promise<void>;
  busy: boolean;
  error: string;
};

export function SchoolDialog({
  selected,
  modalOpen,
  close,
  form,
  save,
  busy,
  error,
}: Props) {
  return (
    <Modal
      title={selected ? "编辑学校" : "新增学校"}
      open={modalOpen}
      onCancel={close}
      onOk={() => form.submit()}
      confirmLoading={busy}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
    >
      {error && <Alert type="error" title={error} className="mb-4" />}
      <Form form={form} layout="vertical" onFinish={save} className="mt-5">
        <Form.Item
          label="学校编码"
          name="code"
          rules={[{ required: true, min: 2, max: 64 }]}
        >
          <Input disabled={!!selected} placeholder="例如 SCHOOL_001" />
        </Form.Item>
        <Form.Item
          label="学校名称"
          name="name"
          rules={[{ required: true, min: 2, max: 200 }]}
        >
          <Input placeholder="请输入学校名称" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
