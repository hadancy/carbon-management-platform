"use client";

import { formatBeijingTime } from "@/shared/beijing-time";
import Link from "next/link";
import { Button, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ModelRow, ModelVersionView, ModelView } from "./types";
import { modelVersionHref, statusLabels } from "./types";

function publishedDate(value: string | null) {
  return value ? formatBeijingTime(value, "date") : "—";
}

function statusTag(status: ModelVersionView["status"]) {
  const colors = {
    PUBLISHED: "green",
    SUBMITTED: "blue",
    REJECTED: "red",
    DRAFT: "default",
  } as const;
  return <Tag color={colors[status]}>{statusLabels[status]}</Tag>;
}

export function ModelListTable({
  models,
  search,
  isTemplate,
  canWrite,
  canReview,
  workspace,
  busy,
  onNewVersion,
  onUseTemplate,
  onDeleteVersion,
  onDeleteModel,
}: {
  models: ModelView[];
  search: string;
  isTemplate: boolean;
  canWrite: boolean;
  canReview: boolean;
  workspace: "SCHOOL" | "PUBLIC";
  busy: boolean;
  onNewVersion: (model: ModelView) => void;
  onUseTemplate: (versionId: string) => void;
  onDeleteVersion: (version: ModelVersionView) => void;
  onDeleteModel: (model: ModelView) => void;
}) {
  const query = search.trim().toLocaleLowerCase();
  const publicList = workspace === "PUBLIC" || isTemplate;
  const rows: ModelRow[] = models
    .filter(
      (model) =>
        !query ||
        model.code.toLocaleLowerCase().includes(query) ||
        model.versions.some((version) =>
          version.content.name.toLocaleLowerCase().includes(query),
        ),
    )
    .filter((model) => model.versions.length > 0)
    .map((model) => ({ model, version: model.versions[0] }));

  function versionLink(
    model: ModelView,
    version: ModelVersionView,
    label: string,
  ) {
    return (
      <Link
        href={modelVersionHref(workspace, model.id, version.id)}
        className="inline-flex min-h-8 items-center px-2 text-sm text-blue-600 hover:text-blue-500"
      >
        {label}
      </Link>
    );
  }

  function newVersionAction(row: ModelRow) {
    const button = (
      <Button
        type="link"
        size="small"
        loading={busy}
        disabled={busy}
        onClick={
          workspace === "PUBLIC" ? undefined : () => onNewVersion(row.model)
        }
      >
        新版本
      </Button>
    );

    if (workspace !== "PUBLIC") return button;

    return (
      <Popconfirm
        title={`确定为 ${row.model.code} 创建新版本？`}
        description={`将复制已发布的 v${row.version.version} 版本内容，创建 v${row.version.version + 1} 草稿；原版本保持不变。`}
        okText="创建新版本"
        cancelText="取消"
        okButtonProps={{ loading: busy }}
        onConfirm={() => onNewVersion(row.model)}
      >
        {button}
      </Popconfirm>
    );
  }

  return (
    <Table<ModelRow>
      rowKey={(row) => row.model.id}
      dataSource={rows}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 900 }}
      locale={{ emptyText: search ? "没有匹配的模型" : "暂无模型" }}
      expandable={{
        rowExpandable: (row) => row.model.versions.length > 1,
        expandedRowRender: (row) => (
          <div className="pl-2">
            <Typography.Text strong>历史版本</Typography.Text>
            <Table<ModelVersionView>
              rowKey="id"
              size="small"
              className="mt-2"
              pagination={false}
              dataSource={row.model.versions.slice(1)}
              scroll={{ x: 620 }}
              columns={[
                {
                  title: "版本",
                  dataIndex: "version",
                  width: 90,
                  render: (value: number) => `v${value}`,
                },
                {
                  title: "模型名称",
                  width: 190,
                  render: (_, version) => version.content.name || "未填写",
                },
                {
                  title: "状态",
                  width: 100,
                  render: (_, version) => statusTag(version.status),
                },
                {
                  title: "发布时间",
                  width: 120,
                  render: (_, version) => publishedDate(version.publishedAt),
                },
                {
                  title: "操作",
                  width: 160,
                  render: (_, version) => (
                    <Space size={0}>
                      {versionLink(row.model, version, "查看")}
                      {isTemplate && canWrite && (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => onUseTemplate(version.id)}
                        >
                          引用模板
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        ),
      }}
      columns={[
        { title: "模型编码", width: 140, render: (_, row) => row.model.code },
        {
          title: "模型名称",
          width: 210,
          render: (_, row) => row.version.content.name || "未填写",
        },
        {
          title: "最新版本",
          width: 110,
          render: (_, row) => (
            <Space size={4}>
              <span>v{row.version.version}</span>
              {row.model.versions.length > 1 && (
                <Typography.Text type="secondary" className="text-xs">
                  共{row.model.versions.length}版
                </Typography.Text>
              )}
            </Space>
          ),
        },
        {
          title: "状态",
          width: 100,
          render: (_, row) => statusTag(row.version.status),
        },
        {
          title: publicList ? "最近发布时间" : "来源",
          width: 155,
          render: (_, row) =>
            publicList
              ? publishedDate(
                  row.model.versions.find(
                    (version) => version.status === "PUBLISHED",
                  )?.publishedAt ?? null,
                )
              : (row.model.sourceLabel ?? "自行创建"),
        },
        {
          title: "操作",
          width: 250,
          render: (_, row) => (
            <Space size={0} wrap>
              {versionLink(
                row.model,
                row.version,
                !isTemplate &&
                  canWrite &&
                  ["DRAFT", "REJECTED"].includes(row.version.status)
                  ? "编辑"
                  : "查看",
              )}
              {!isTemplate &&
                canWrite &&
                row.version.status === "PUBLISHED" &&
                newVersionAction(row)}
              {isTemplate && canWrite && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => onUseTemplate(row.version.id)}
                >
                  引用模板
                </Button>
              )}
              {!isTemplate &&
                canWrite &&
                ["DRAFT", "REJECTED"].includes(row.version.status) && (
                  <Popconfirm
                    title={`删除 ${row.model.code} v${row.version.version} 草稿？`}
                    description={
                      row.model.versions.length > 1
                        ? "只删除这个草稿版本；此前已发布的版本会保留。"
                        : "这是该模型的唯一版本；删除后模型会从列表移除。"
                    }
                    okText="删除草稿"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: busy }}
                    onConfirm={() => onDeleteVersion(row.version)}
                  >
                    <Button type="link" size="small" danger disabled={busy}>
                      删除草稿
                    </Button>
                  </Popconfirm>
                )}
              {!isTemplate &&
                row.version.status === "PUBLISHED" &&
                canReview && (
                  <Popconfirm
                    title={`归档整个模型 ${row.model.code}？`}
                    description="所有版本会从列表移除；历史版本和已有学校副本会保留。"
                    okText="归档模型"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: busy }}
                    onConfirm={() => onDeleteModel(row.model)}
                  >
                    <Button type="link" size="small" danger disabled={busy}>
                      归档模型
                    </Button>
                  </Popconfirm>
                )}
            </Space>
          ),
        },
      ]}
    />
  );
}
