"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Flex, Form, Input, Modal, Typography } from "antd";
import {
  calculationFactorSchema,
  parseEmissionFactorContent,
} from "@/shared/emission-factors";
import { adminRequest } from "./api";
import { PublicDataTable } from "./public-data/public-data-table";
import { PublicDataDialog } from "./public-data/public-data-dialog";
import {
  factorContentFromFields,
  factorFieldsFromContent,
} from "./public-data/factor-form";
import type { Entry, PublicDataForm } from "./public-data/types";
import { publicReportTemplateSchema } from "@/shared/report-template";
import {
  templateContentFromFields,
  templateFieldsFromContent,
} from "./public-data/report-template-form";
import { pvRuleSchema } from "@/shared/calculation-rule";
import {
  ruleFieldsFromContent,
  ruleContentFromFields,
} from "./public-data/rule-form";

export function PublicDataManager({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [form] = Form.useForm<PublicDataForm>();
  const [retireForm] = Form.useForm<{ reason: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copySource, setCopySource] = useState<Entry | null>(null);
  const [retireTarget, setRetireTarget] = useState<Entry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [publishMode, setPublishMode] = useState(false);
  const editingEntry = entries.find((entry) => entry.id === editingId);
  const legacyFactorContent =
    copySource?.type === "EMISSION_FACTOR"
      ? copySource.content
      : editingEntry?.type === "EMISSION_FACTOR" &&
          !parseEmissionFactorContent(editingEntry.content)
        ? editingEntry.content
        : null;

  useEffect(() => {
    if (!modalOpen) return;
    const entry = entries.find((item) => item.id === editingId) ?? copySource;
    form.resetFields();
    if (entry) {
      form.setFieldsValue({
        type: entry.type,
        code: entry.code,
        version: copySource ? "" : entry.version,
        title: entry.title,
        source: entry.source ?? "",
        contentText: entry.content,
        ...(entry.type === "EMISSION_FACTOR"
          ? factorFieldsFromContent(entry.content)
          : entry.type === "RULE_CONFIG"
            ? ruleFieldsFromContent(entry.content)
            : templateFieldsFromContent(entry.content)),
        factorSupersedesVersionId:
          copySource?.id ??
          factorFieldsFromContent(entry.content).factorSupersedesVersionId,
      });
    } else {
      form.setFieldsValue({
        factorPurpose: "TEST",
        factorRegion: "ALL",
        factorTechnology: "ALL",
        rulePurpose: "TEST",
        templatePurpose: "TEST",
        templateTitleSuffix: "碳足迹报告",
      });
    }
  }, [editingId, copySource, entries, form, modalOpen]);

  async function save(values: PublicDataForm) {
    setError("");
    let content: unknown;
    if (values.type === "EMISSION_FACTOR") {
      try {
        content = factorContentFromFields(values, legacyFactorContent);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "因子内容无效");
        return;
      }
    } else if (values.type === "RULE_CONFIG") {
      content = ruleContentFromFields(values);
    } else {
      content = templateContentFromFields(values);
    }

    if (publishMode && values.type === "EMISSION_FACTOR") {
      const checked = calculationFactorSchema.safeParse(content);
      if (!checked.success) {
        const issue = checked.error.issues[0];
        setError(
          `${issue?.path.join(".") ?? "content"}：${issue?.message ?? "因子 v2 内容不完整"}`,
        );
        return;
      }
    }
    if (publishMode && values.type === "RULE_CONFIG") {
      const checked = pvRuleSchema.safeParse(content);
      if (!checked.success) {
        setError(checked.error.issues[0]?.message ?? "规则内容不完整");
        return;
      }
    }

    if (publishMode && values.type === "REPORT_TEMPLATE") {
      const checked = publicReportTemplateSchema.safeParse(content);
      if (!checked.success) {
        setError(checked.error.issues[0]?.message ?? "模板内容不完整");
        return;
      }
    }
    setBusy(true);
    try {
      const saved = await adminRequest<{ entry: { id: string } }>(
        editingId
          ? `/api/admin/public-data/${editingId}`
          : "/api/admin/public-data",
        editingId ? "PATCH" : "POST",
        {
          ...(editingId
            ? {}
            : {
                type: values.type,
                code: values.code,
                version: values.version,
              }),
          title: values.title,
          source: values.source,
          content,
        },
      );
      if (publishMode)
        await adminRequest(
          `/api/admin/public-data/${saved.entry.id}/publish`,
          "POST",
          {},
        );
      form.resetFields();
      setEditingId(null);
      setCopySource(null);
      setPublishMode(false);
      setModalOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存草稿失败");
    } finally {
      setBusy(false);
    }
  }

  function edit(entry: Entry) {
    setError("");
    setPublishMode(false);
    setCopySource(null);
    setEditingId(entry.id);
    setModalOpen(true);
  }

  function create() {
    setError("");
    setPublishMode(false);
    setCopySource(null);
    setEditingId(null);
    setModalOpen(true);
  }

  function copyFactor(entry: Entry) {
    setError("");
    setPublishMode(false);
    setEditingId(null);
    setCopySource(entry);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setCopySource(null);
    setPublishMode(false);
    setError("");
    form.resetFields();
  }

  function publish(entry: Entry) {
    setError("");
    setCopySource(null);
    setEditingId(entry.id);
    setPublishMode(true);
    setModalOpen(true);
  }

  async function retire(values: { reason: string }) {
    if (!retireTarget) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(
        `/api/admin/public-data/${retireTarget.id}/retire`,
        "POST",
        values,
      );
      setRetireTarget(null);
      retireForm.resetFields();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "停用失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex vertical gap={14} className="w-full">
      <Flex vertical gap={0}>
        <Typography.Title level={2} className="mt-0 mb-1 text-xl font-semibold">
          公共数据
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          className="m-0 text-[13px] text-[#909399]"
        >
          维护版本化资料；v2 排放因子可作为核算计算快照，发布后内容只读。
        </Typography.Paragraph>
      </Flex>
      {error && !modalOpen && !retireTarget && (
        <Alert type="error" title={error} />
      )}
      <PublicDataTable
        entries={entries}
        create={create}
        edit={edit}
        publish={publish}
        copyFactor={copyFactor}
        retire={(entry) => {
          setError("");
          setRetireTarget(entry);
        }}
      />
      <PublicDataDialog
        editingId={editingId}
        copyingFactor={!!copySource}
        publishMode={publishMode}
        modalOpen={modalOpen}
        closeModal={closeModal}
        form={form}
        save={save}
        busy={busy}
        error={error}
        legacyFactorContent={legacyFactorContent}
      />
      <Modal
        title={`停用因子 ${retireTarget?.code ?? ""} v${retireTarget?.version ?? ""}`}
        open={!!retireTarget}
        confirmLoading={busy}
        onCancel={() => {
          setRetireTarget(null);
          retireForm.resetFields();
        }}
        onOk={() => retireForm.submit()}
        okText="确认停用"
      >
        {error && <Alert type="error" title={error} className="mb-3" />}
        <Form form={retireForm} layout="vertical" onFinish={retire}>
          <Form.Item
            label="停用原因"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: "请填写停用原因" },
            ]}
          >
            <Input.TextArea rows={3} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
