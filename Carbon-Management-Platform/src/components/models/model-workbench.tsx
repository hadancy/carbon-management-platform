"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Input, Tabs, Typography } from "antd";
import { adminRequest } from "@/components/admin/api";
import { emptyModelContent } from "@/shared/models";
import type { ModelVersionView, ModelView } from "./types";
import { modelVersionHref } from "./types";
import {
  ModelCreateDialog,
  type CreateModelValues,
} from "./model-create-dialog";
import { ModelListTable } from "./model-list-table";

export function ModelWorkbench({
  scope,
  models,
  publicModels = [],
  canWrite,
  canReview,
}: {
  scope: "SCHOOL" | "PUBLIC";
  models: ModelView[];
  publicModels?: ModelView[];
  canWrite: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceVersionId, setSourceVersionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("mine");

  const templateOptions = publicModels.flatMap((model) =>
    model.versions.map((version) => ({
      value: version.id,
      label: `${model.code} v${version.version} · ${version.content.name}`,
    })),
  );

  function openCreate(source?: string) {
    setSourceVersionId(source);
    setError("");
    setCreateOpen(true);
  }

  async function create(values: CreateModelValues) {
    setError("");
    setBusy(true);
    try {
      const content = emptyModelContent();
      content.name = values.name?.trim() ?? "";
      const result = await adminRequest<{
        model: { id: string; versions: { id: string }[] };
      }>(scope === "PUBLIC" ? "/api/admin/models" : "/api/models", "POST", {
        code: values.code,
        ...(values.sourceVersionId
          ? { sourceVersionId: values.sourceVersionId }
          : { content }),
      });
      message.success(scope === "PUBLIC" ? "模板草稿已创建" : "模型草稿已创建");
      setCreateOpen(false);
      router.push(
        modelVersionHref(scope, result.model.id, result.model.versions[0].id),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function newVersion(model: ModelView) {
    setError("");
    setBusy(true);
    try {
      const result = await adminRequest<{ version: { id: string } }>(
        `/api/models/${model.id}/versions`,
        "POST",
        {},
      );
      message.success("新版本草稿已创建");
      router.push(modelVersionHref(scope, model.id, result.version.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建新版本失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteVersion(version: ModelVersionView) {
    setError("");
    setBusy(true);
    try {
      await adminRequest(`/api/model-versions/${version.id}`, "DELETE");
      message.success("草稿版本已删除");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除草稿失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteModel(model: ModelView) {
    setError("");
    setBusy(true);
    try {
      await adminRequest(`/api/models/${model.id}`, "DELETE");
      message.success("模型已归档");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "归档模型失败");
    } finally {
      setBusy(false);
    }
  }

  function table(entries: ModelView[], isTemplate: boolean) {
    return (
      <ModelListTable
        models={entries}
        search={search}
        isTemplate={isTemplate}
        canWrite={canWrite}
        canReview={canReview}
        workspace={scope}
        busy={busy}
        onNewVersion={(model) => void newVersion(model)}
        onUseTemplate={openCreate}
        onDeleteVersion={(version) => void deleteVersion(version)}
        onDeleteModel={(model) => void deleteModel(model)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title
            level={2}
            className="mt-0 mb-1 text-xl font-semibold"
          >
            {scope === "PUBLIC" ? "公用模型模板" : "碳足迹模型"}
          </Typography.Title>
          <Typography.Text type="secondary">
            {scope === "PUBLIC"
              ? "平台维护所有学校可引用的公用模板；每次发布的版本固定不变。"
              : "创建本校模型或引用公用模板，添加阶段、大类和数据项后提交校内审核。"}
          </Typography.Text>
        </div>
        {canWrite && (
          <Button type="primary" onClick={() => openCreate()}>
            {scope === "PUBLIC" ? "新建模板" : "新建模型"}
          </Button>
        )}
      </div>
      {error && !createOpen && <Alert type="error" title={error} />}
      {scope === "SCHOOL" && (
        <Alert
          type="info"
          showIcon
          title="校内审核需要另一位成员"
          description="模型版本的创建人、最后编辑人和提交人不能审核该版本；请由其他拥有模型发布权限的成员处理。"
        />
      )}
      <Input.Search
        placeholder="搜索模型编码或名称"
        allowClear
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-80"
      />
      {scope === "SCHOOL" ? (
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: "mine",
              label: `本校模型 (${models.length})`,
              children: table(models, false),
            },
            {
              key: "templates",
              label: `公用模板 (${publicModels.length})`,
              children: table(publicModels, true),
            },
          ]}
        />
      ) : (
        table(models, false)
      )}
      <ModelCreateDialog
        scope={scope}
        open={createOpen}
        sourceVersionId={sourceVersionId}
        templateOptions={templateOptions}
        busy={busy}
        error={error}
        onCancel={() => setCreateOpen(false)}
        onCreate={(values) => void create(values)}
      />
    </div>
  );
}
