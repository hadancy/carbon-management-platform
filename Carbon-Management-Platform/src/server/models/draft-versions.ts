import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/admin/audit";
import { recordModelDataItemUsage } from "@/server/data-items/usage";
import { modelContentSchema } from "@/shared/models";

export async function lockModelVersionWrites(
  tx: Prisma.TransactionClient,
  modelId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "FootprintModel" WHERE "id" = ${modelId}::uuid FOR NO KEY UPDATE`;
}

export async function createModelDraft(
  tx: Prisma.TransactionClient,
  input: {
    model: { id: string; code: string; schoolId: string | null };
    actorId: string;
    authorId?: string;
    version: number;
    content: Prisma.InputJsonValue;
  },
) {
  const { model, actorId, authorId = actorId, version, content } = input;
  const draft = await tx.modelVersion.create({
    data: {
      modelId: model.id,
      version,
      content,
      createdById: authorId,
      lastEditedById: authorId,
    },
  });
  await recordModelDataItemUsage(
    tx,
    draft.id,
    modelContentSchema.parse(content),
  );
  await audit(tx, {
    actorId,
    schoolId: model.schoolId ?? undefined,
    action: "model.version.create",
    targetType: "ModelVersion",
    targetId: draft.id,
    details: { code: model.code, version },
  });
  return draft;
}
