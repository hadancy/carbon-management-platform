"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ModelContent } from "@/shared/models";
import {
  normalizeLegacyModelContent,
  validatePublishableModel,
} from "@/shared/models";
import { adminRequest } from "@/components/admin/api";
import type { ModelVersionView, ModelView } from "./types";
import { statusLabels } from "./types";
import { ModelStructureEditor } from "./model-structure-editor";
import { ModelBasicForm } from "./model-basic-form";
import { ModelBoundaryDiagramField } from "./model-boundary-diagram-field";
import { ModelCalculationProfile } from "./model-calculation-profile";
import { synchronizePvProfile } from "@/shared/calculation-profile";
import { useUnsavedChangesWarning } from "@/components/backend/use-unsaved-changes-warning";

export function ModelVersionEditor({
  model,
  version,
  canWrite,
  canReview,
  currentUserId,
  backHref,
}: {
  model: ModelView;
  version: ModelVersionView;
  canWrite: boolean;
  canReview: boolean;
  currentUserId: string;
  backHref: "/models" | "/admin/models";
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [basicForm] = Form.useForm<ModelContent>();
  const [structureForm] = Form.useForm();
  const [content, setContent] = useState<ModelContent>(version.content);
  const [savedContent, setSavedContent] = useState<ModelContent>(
    version.content,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [legacyConversions, setLegacyConversions] = useState(0);
  const editable =
    canWrite && (version.status === "DRAFT" || version.status === "REJECTED");
  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);
  useUnsavedChangesWarning(editable && dirty);

  const canSchoolReviewOwn =
    version.createdById !== currentUserId &&
    version.lastEditedById !== currentUserId &&
    version.submittedById !== currentUserId;
  const canPublish =
    model.scope === "PUBLIC"
      ? canWrite && version.status === "DRAFT"
      : canReview && version.status === "SUBMITTED" && canSchoolReviewOwn;

  async function save(nextContent: ModelContent) {
    const saved = await adminRequest<{ version: { content: ModelContent } }>(
      `/api/model-versions/${version.id}`,
      "PATCH",
      nextContent,
    );
    setContent(saved.version.content);
    setSavedContent(structuredClone(saved.version.content));
  }

  async function validateForRelease() {
    if (editable) {
      try {
        await Promise.all([
          basicForm.validateFields(),
          structureForm.validateFields(),
        ]);
      } catch {
        setError("请修正表单中标红的字段");
        return null;
      }
    }
    const normalized = normalizeLegacyModelContent(content);
    const problem = validatePublishableModel(normalized.content);
    if (problem) {
      setError(problem);
      return null;
    }
    return normalized;
  }

  async function openPublish() {
    setError("");
    const normalized = await validateForRelease();
    if (normalized) {
      setLegacyConversions(
        normalized.convertedFactors + normalized.convertedUnits,
      );
      setPublishOpen(true);
    }
  }

  async function act(
    action: "save" | "submit" | "publish" | "reject",
    note?: string,
  ) {
    setError("");
    let nextContent = content;
    if (action !== "save" && action !== "reject") {
      const normalized = await validateForRelease();
      if (!normalized) {
        if (action === "publish") setPublishOpen(false);
        return;
      }
      nextContent = normalized.content;
    }
    setBusy(true);
    try {
      if (
        editable &&
        (action === "save" ||
          JSON.stringify(nextContent) !== JSON.stringify(savedContent))
      )
        await save(nextContent);
      if (action !== "save") {
        await adminRequest(
          `/api/model-versions/${version.id}/transition`,
          "POST",
          { action, note },
        );
      }
      message.success(
        action === "save"
          ? "草稿已保存"
          : action === "submit"
            ? "已提交审核"
            : action === "publish"
              ? "模型已发布"
              : "已驳回",
      );
      if (action === "publish") setPublishOpen(false);
      if (action === "save") router.refresh();
      else router.push(backHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500"
          >
            <ArrowLeftOutlined />
            返回模型列表
          </Link>
          <Typography.Title level={3} className="mt-2 mb-0">
            {model.code} · v{version.version} · {statusLabels[version.status]}
          </Typography.Title>
          {editable && (
            <Tag color={dirty ? "orange" : "green"} className="mt-2">
              {dirty ? "有未保存修改" : "修改已保存"}
            </Tag>
          )}
        </div>
        <Space wrap>
          {editable && (
            <Button loading={busy} onClick={() => void act("save")}>
              保存草稿
            </Button>
          )}
          {editable && model.scope === "SCHOOL" && (
            <Button
              type="primary"
              loading={busy}
              onClick={() => void act("submit")}
            >
              提交审核
            </Button>
          )}
          {canPublish && (
            <Button
              type="primary"
              loading={busy}
              onClick={() => void openPublish()}
            >
              发布
            </Button>
          )}
          {model.scope === "SCHOOL" &&
            canReview &&
            version.status === "SUBMITTED" &&
            canSchoolReviewOwn && (
              <Button danger loading={busy} onClick={() => setRejectOpen(true)}>
                驳回
              </Button>
            )}
        </Space>
      </div>
      <div className="space-y-4">
        {error && <Alert type="error" title={error} />}
        {version.reviewNote && (
          <Alert
            type="warning"
            title="驳回原因"
            description={version.reviewNote}
          />
        )}
        {model.sourceLabel && (
          <Alert type="info" title={`来源：公用模板 ${model.sourceLabel}`} />
        )}
        <Typography.Text type="secondary">
          {model.scope === "PUBLIC"
            ? "公用模板由平台管理员发布，供学校复制为本校模型。"
            : "本校模型由校内角色审核发布，发布后版本不可修改。"}
        </Typography.Text>
        {editable && (
          <Typography.Text type="secondary">
            未完成的内容可先保存草稿；提交或发布时须完成必填字段。
          </Typography.Text>
        )}
        <ModelBasicForm
          form={basicForm}
          content={content}
          onChange={setContent}
          readOnly={!editable}
        />
        <ModelBoundaryDiagramField
          value={content.boundaryDiagram}
          onChange={(boundaryDiagram) =>
            setContent((current) => ({ ...current, boundaryDiagram }))
          }
          readOnly={!editable}
        />
        <Divider />
        <ModelStructureEditor
          form={structureForm}
          content={content}
          onChange={(next) => setContent(synchronizePvProfile(next))}
          readOnly={!editable}
        />
        <ModelCalculationProfile
          content={content}
          onChange={setContent}
          readOnly={!editable}
        />
      </div>
      <Modal
        title={
          model.scope === "PUBLIC" ? "确认发布公用模板" : "确认发布本校模型"
        }
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={() => void act("publish")}
        okText="确认发布"
        confirmLoading={busy}
        okButtonProps={{ disabled: busy }}
      >
        {error && <Alert type="error" title={error} className="mb-3" />}
        <Typography.Paragraph>
          {model.code} · v{version.version} · {content.name || "未填写名称"}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          包含 {content.stages.length} 个阶段、{" "}
          {content.stages.reduce(
            (count, stage) => count + stage.categories.length,
            0,
          )}{" "}
          个大类、{" "}
          {content.stages.reduce(
            (count, stage) =>
              count +
              stage.categories.reduce(
                (total, category) => total + category.items.length,
                0,
              ),
            0,
          )}{" "}
          个数据项。
        </Typography.Paragraph>
        {legacyConversions > 0 && (
          <Alert
            type="info"
            showIcon
            title={`发布时将把 ${legacyConversions} 处已识别的旧版单位或因子格式转换为新格式`}
            className="mb-3"
          />
        )}
        <Alert
          type="info"
          showIcon
          title={
            model.scope === "PUBLIC"
              ? "发布后所有学校都能引用此版本；内容将冻结，后续修改需创建新版本。"
              : "发布后本校可使用此版本；内容将冻结，后续修改需创建新版本。"
          }
        />
      </Modal>
      <Modal
        title="驳回模型版本"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          if (rejectNote.trim()) {
            setRejectOpen(false);
            void act("reject", rejectNote);
          }
        }}
        okText="确认驳回"
      >
        <Input.TextArea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="请填写需要修改的内容"
        />
      </Modal>
    </div>
  );
}
