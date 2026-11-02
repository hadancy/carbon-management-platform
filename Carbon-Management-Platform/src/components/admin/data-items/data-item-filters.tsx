"use client";

import { useEffect } from "react";
import { Button, Form, Input, Select, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import {
  dataItemStatusOptions,
  type DataItemListQuery,
} from "@/shared/data-items";
import { unitOptions } from "@/shared/units";

type Filters = Pick<DataItemListQuery, "q" | "status" | "unit">;

export function DataItemFilters({
  query,
  loading,
  onSearch,
}: {
  query: DataItemListQuery;
  loading: boolean;
  onSearch: (filters: Filters) => void;
}) {
  const [form] = Form.useForm<Filters>();
  useEffect(() => {
    form.setFieldsValue({
      q: query.q,
      status: query.status,
      unit: query.unit || undefined,
    });
  }, [form, query.q, query.status, query.unit]);

  return (
    <Form
      form={form}
      layout="inline"
      className="flex flex-wrap gap-y-3"
      onFinish={(values) =>
        onSearch({
          ...values,
          q: values.q?.trim() ?? "",
          unit: values.unit ?? "",
        })
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
          placeholder="名称、编码、规格或厂家"
          className="w-64 max-sm:w-full"
        />
      </Form.Item>
      <Form.Item name="status" label="状态">
        <Select options={dataItemStatusOptions} className="w-28" />
      </Form.Item>
      <Form.Item name="unit" label="单位">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          options={unitOptions}
          placeholder="全部单位"
          className="w-40"
        />
      </Form.Item>
      <Form.Item className="mr-0">
        <Space>
          <Button
            htmlType="submit"
            type="primary"
            icon={<SearchOutlined aria-hidden />}
            loading={loading}
          >
            搜索
          </Button>
          <Button
            disabled={loading}
            onClick={() => onSearch({ q: "", status: "ALL", unit: "" })}
          >
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
