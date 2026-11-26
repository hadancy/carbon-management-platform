"use client";

import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Modal,
  Select,
  type FormInstance,
} from "antd";
import type { ModelRow } from "@/domain/calculation/model-rows";
import { batchEvidenceTargets, planBatchEvidence } from "./batch-evidence";
import { EvidenceUpload } from "./evidence-upload";
import type { AccountingFormValues } from "./types";

type Selection = { targetKeys: string[]; assetIds: string[] };
const requiredSelection = { type: "array" as const, required: true, min: 1 };
const sections = [
  ["lines", "生命周期活动数据"],
  ["annualEnergy", "运行年度电量"],
] as const;

export function BatchEvidenceDialog({
  accountingForm,
  rows,
  onApplied,
}: {
  accountingForm: FormInstance<AccountingFormValues>;
  rows: readonly ModelRow[];
  onApplied: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Selection>();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = open
    ? batchEvidenceTargets(accountingForm.getFieldsValue(true), rows)
    : [];

  function apply({ targetKeys, assetIds }: Selection) {
    if (uploading) return;
    const latest = batchEvidenceTargets(
      accountingForm.getFieldsValue(true),
      rows,
    );
    const plan = planBatchEvidence(latest, targetKeys, assetIds);
    if (plan.error) {
      setError(plan.error);
      return;
    }
    if (!plan.updates.length) {
      message.info("所选记录已关联这些凭证");
      setOpen(false);
      return;
    }
    accountingForm.setFields(
      plan.updates.map(({ section, index, assetIds }) => ({
        name: [section, index, "evidenceAssetIds"],
        value: assetIds,
      })),
    );
    onApplied();
    setOpen(false);
    message.success(`已关联到 ${plan.updates.length} 条记录，请保存草稿`);
  }

  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        批量关联凭证
      </Button>
      <Modal
        title="批量关联凭证"
        open={open}
        destroyOnHidden
        closable={!uploading}
        keyboard={!uploading}
        cancelButtonProps={{ disabled: uploading }}
        okButtonProps={{ disabled: uploading }}
        onCancel={() => {
          if (!uploading) setOpen(false);
        }}
        onOk={() => form.submit()}
        okText="关联到所选记录"
      >
        {error && (
          <Alert className="mb-4" type="error" showIcon title={error} />
        )}
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onValuesChange={() => setError(null)}
          onFinish={apply}
        >
          <Form.Item
            name="targetKeys"
            label="关联记录"
            rules={[
              { ...requiredSelection, message: "请至少选择一条活动或年度记录" },
            ]}
          >
            <Select
              mode="multiple"
              showSearch={{ optionFilterProp: "label" }}
              maxTagCount={3}
              placeholder="选择活动或已录入的运行年度"
              options={sections.flatMap(([section, label]) => {
                const options = targets
                  .filter((target) => target.section === section)
                  .map((target) => ({
                    value: target.key,
                    label: target.label,
                  }));
                return options.length ? [{ label, options }] : [];
              })}
              notFoundContent="请先录入活动或运行年度"
            />
          </Form.Item>
          <Form.Item
            name="assetIds"
            label="共用凭证"
            rules={[
              { ...requiredSelection, message: "请至少选择一个凭证附件" },
            ]}
          >
            <EvidenceUpload onUploadBusyChange={setUploading} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
