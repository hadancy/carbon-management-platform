"use client";

import { Button, Form, Input, Select, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { unitOptions } from "@/shared/units";
import type { DataItemCatalogQuery } from "@/shared/data-items";

export function DataItemPickerFilters({
  loading,
  onSearch,
}: {
  loading: boolean;
  onSearch: (filters: Pick<DataItemCatalogQuery, "q" | "unit">) => void;
}) {
  const [form] = Form.useForm<{ q: string; unit?: string }>();
  return (
    <Form
      form={form}
      layout="inline"
      initialValues={{ q: "" }}
      className="mb-4 flex flex-wrap gap-y-3"
      onFinish={(values) =>
        onSearch({ q: values.q?.trim() ?? "", unit: values.unit ?? "" })
      }
    >
      <Form.Item
        name="q"
        label="关键字"
        className="max-sm:w-full max-sm:[&_.ant-form-item-control]:min-w-0"
      >
        <Input
          allowClear
          maxLength={200}
          className="w-64 max-sm:w-full"
          placeholder="名称、编码、规格或厂家"
        />
      </Form.Item>
      <Form.Item name="unit" label="活动单位">
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          options={unitOptions}
          className="w-40"
          placeholder="全部单位"
        />
      </Form.Item>
      <Form.Item className="mr-0">
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SearchOutlined aria-hidden />}
          >
            搜索
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              form.resetFields();
              onSearch({ q: "", unit: "" });
            }}
          >
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
