import "server-only";
import type { ModelContent } from "@/shared/models";
import { modelContentSchema } from "@/shared/models";
import type { ModelView } from "@/components/models/types";

type DatabaseModel = {
  id: string;
  code: string;
  scope: "PUBLIC" | "SCHOOL";
  sourceVersion?: { version: number; model: { code: string } } | null;
  versions: {
    id: string;
    version: number;
    status: "DRAFT" | "SUBMITTED" | "REJECTED" | "PUBLISHED";
    content: unknown;
    createdById: string;
    lastEditedById: string;
    submittedById: string | null;
    reviewNote: string | null;
    publishedAt: Date | null;
  }[];
};

export function toModelView(model: DatabaseModel): ModelView {
  return {
    id: model.id,
    code: model.code,
    scope: model.scope,
    sourceLabel: model.sourceVersion
      ? `${model.sourceVersion.model.code} v${model.sourceVersion.version}`
      : undefined,
    versions: model.versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      content: modelContentSchema.parse(version.content) as ModelContent,
      createdById: version.createdById,
      lastEditedById: version.lastEditedById,
      submittedById: version.submittedById,
      reviewNote: version.reviewNote,
      publishedAt: version.publishedAt?.toISOString() ?? null,
    })),
  };
}
