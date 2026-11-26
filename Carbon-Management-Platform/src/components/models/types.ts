import type { ModelContent } from "@/shared/models";

export type ModelVersionView = {
  id: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "REJECTED" | "PUBLISHED";
  content: ModelContent;
  createdById: string;
  lastEditedById: string;
  submittedById: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type ModelView = {
  id: string;
  code: string;
  scope: "PUBLIC" | "SCHOOL";
  sourceLabel?: string;
  versions: ModelVersionView[];
};

export type ModelRow = {
  model: ModelView;
  version: ModelVersionView;
};

export function modelVersionHref(
  workspace: "SCHOOL" | "PUBLIC",
  modelId: string,
  versionId: string,
) {
  const base = workspace === "PUBLIC" ? "/admin/models" : "/models";
  return `${base}/${modelId}/versions/${versionId}`;
}

export const statusLabels: Record<ModelVersionView["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  REJECTED: "已驳回",
  PUBLISHED: "已发布",
};
