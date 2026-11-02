"use client";

import { useState } from "react";
import { Alert, App, Form, Input, Modal, Select, Typography } from "antd";
import type { DataItemEntry, DataItemFields } from "@/shared/data-items";
import {
  factorUnitLabel,
  isKnownUnit,
  isNumericFactor,
  unitOptions,
} from "@/shared/units";
import { useUnsavedChangesWarning } from "@/components/backend/use-unsaved-changes-warning";

export type DataItemEditor =
  | { mode: "create"; entry: null }
  | { mode: "edit" | "publish" | "new-version"; entry: DataItemEntry };
export type DataItemFormValues = DataItemFields & { code: string };

export function DataItemDialog({
  editor,
  busy,
  error,
  onCancel,
  onSave,
}: {
  editor: DataItemEditor;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (values: DataItemFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<DataItemFormValues>();
  const [dirty, setDirty] = useState(false);
  const { modal } = App.useApp();
  const unit = Form.useWatch("functionalUnit", form);
  const publish = editor.mode === "publish";
  const entry = editor.entry;
  useUnsavedChangesWarning(dirty && !busy);

  function close() {
    if (busy) return;
    if (!dirty) return onCancel();
    modal.confirm({
      title: "放弃尚未保存的修改？",
      okText: "放弃修改",
      cancelText: "继续编辑",
      onOk: onCancel,
    });
  }

  return (
    <Modal
      open
      title={
        publish
          ? "校验并发布数据项"
          : editor.mode === "new-version"
            ? "创建数据项新版本"
            : editor.mode === "edit"
              ? "编辑数据项草稿"
              : "新增公共数据项"
      }
      width={720}
      okText={publish ? "校验并发布" : "保存草稿"}
      cancelText="取消"
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onCancel={close}
      onOk={() => form.submit()}
      className="[&_.ant-modal-body]:max-h-[68vh] [&_.ant-modal-body]:overflow-y-auto"
    >
      <Typography.Paragraph type="secondary" className="mb-4 text-xs">
        {publish
          ? "发布后内容只读，可在后续创建新版本维护。"
          : editor.mode === "new-version"
            ? `基于 ${entry?.code} v${entry?.version} 创建，保存后自动分配下一版本号。`
            : "可先保存未完成草稿；发布前需填写数据名称并选择活动数据单位。"}
      </Typography.Paragraph>
      {error && <Alert type="error" title={error} className="mb-4" />}
      <Form
        form={form}
        layout="vertical"
        onValuesChange={() => setDirty(true)}
        onFinish={onSave}
        initialValues={{
          code: entry?.code ?? "",
          dataName: entry?.dataName ?? "",
          specModel: entry?.specModel ?? "",
          manufacturer: entry?.manufacturer ?? "",
          carbonFootprintFactor: entry?.carbonFootprintFactor ?? "",
          functionalUnit: entry?.functionalUnit || undefined,
          emissionFactor: entry?.emissionFactor ?? "",
          factorSource: entry?.factorSource ?? "",
          dataSource: entry?.dataSource ?? "",
        }}
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="code"
            label="数据项编码"
            extra={
              editor.mode === "create"
                ? "用于唯一识别数据项，保存后不可修改。"
                : `当前编码：${entry?.code}`
            }
            rules={[
              { required: true, whitespace: true, message: "请填写数据项编码" },
              { min: 2, max: 80, message: "编码长度为 2～80 个字符" },
              {
                pattern: /^[A-Za-z0-9_-]+$/,
                message: "仅支持字母、数字、下划线和连字符",
              },
            ]}
          >
            <Input
              maxLength={80}
              disabled={editor.mode !== "create" || busy}
              placeholder="例如 DIESEL"
            />
          </Form.Item>
          <Form.Item
            label="数据名称"
            name="dataName"
            rules={[
              { required: true, whitespace: true, message: "请填写数据名称" },
            ]}
          >
            <Input maxLength={200} disabled={busy} />
          </Form.Item>
          <Form.Item label="规格型号" name="specModel">
            <Input maxLength={200} disabled={busy} />
          </Form.Item>
          <Form.Item label="生产厂家" name="manufacturer">
            <Input maxLength={200} disabled={busy} />
          </Form.Item>
          <Form.Item label="原始碳足迹因子资料" name="carbonFootprintFactor">
            <Input
              maxLength={120}
              disabled={busy}
              placeholder="按已确认来源填写"
            />
          </Form.Item>
          <Form.Item
            label="活动数据单位"
            name="functionalUnit"
            extra="从平台单位目录选择，缺少单位时请先保存草稿。"
            rules={[
              { required: publish, message: "发布前请选择活动数据单位" },
              {
                validator: (_, value?: string) =>
                  !value || isKnownUnit(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error("请选择列表中的活动数据单位")),
              },
            ]}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={unitOptions}
              disabled={busy}
              placeholder="选择活动数据单位"
            />
          </Form.Item>
          <Form.Item
            label="排放因子数值（可选）"
            name="emissionFactor"
            extra={
              unit
                ? `单位：${factorUnitLabel(unit)}`
                : "选择活动数据单位后自动生成因子单位"
            }
            rules={[
              {
                validator: (_, value?: string) =>
                  !value || isNumericFactor(value)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error("仅填写有限数值，单位由活动数据单位生成"),
                      ),
              },
            ]}
          >
            <Input maxLength={120} disabled={busy} placeholder="仅输入数值" />
          </Form.Item>
          <Form.Item label="因子来源" name="factorSource">
            <Input maxLength={300} disabled={busy} />
          </Form.Item>
          <Form.Item
            label="数据来源"
            name="dataSource"
            className="sm:col-span-2"
          >
            <Input.TextArea rows={2} maxLength={300} disabled={busy} />
          </Form.Item>
        </div>
      </Form>
      <Typography.Paragraph type="secondary" className="mb-0 text-xs">
        这里的因子数值用于资料记录；正式核算继续按公用因子规则选用。
      </Typography.Paragraph>
    </Modal>
  );
}
