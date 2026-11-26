import "server-only";
import {
  Prisma,
  type FootprintModel,
  type ModelVersion,
} from "@/generated/prisma/client";
import { audit } from "@/server/admin/audit";
import { toDataItemEntry } from "@/server/data-items/queries";
import { recordModelDataItemUsage } from "@/server/data-items/usage";
import { synchronizePvProfile } from "@/shared/calculation-profile";
import type { DataItemEntry, ModelDataItemChange } from "@/shared/data-items";
import {
  canUpdateModelDataItemDraft,
  modelItemFromCatalog,
} from "@/shared/model-data-items";
import { modelContentSchema, type ModelContent } from "@/shared/models";
import { createModelDraft } from "./draft-versions";

function referencedVersions(content: ModelContent) {
  const referencedVersion = new Map<string, number>();
  for (const stage of content.stages)
    for (const category of stage.categories)
      for (const { librarySource } of category.items) {
        if (!librarySource) continue;
        const { dataItemId, version } = librarySource;
        referencedVersion.set(
          dataItemId,
          Math.min(version, referencedVersion.get(dataItemId) ?? version),
        );
      }
  return referencedVersion;
}

export async function findNewerModelDataItems(
  client: Pick<Prisma.TransactionClient, "dataItemVersion">,
  content: ModelContent,
) {
  const versions = referencedVersions(content);
  if (!versions.size) return new Map<string, DataItemEntry>();
  const available = await client.dataItemVersion.findMany({
    where: {
      dataItemId: { in: [...versions.keys()] },
      status: "PUBLISHED",
      retiredAt: null,
    },
    include: { dataItem: { select: { code: true } } },
  });
  return new Map(
    available
      .filter((entry) => entry.version > versions.get(entry.dataItemId)!)
      .map((entry) => [entry.dataItemId, toDataItemEntry(entry)]),
  );
}

export function upgradeModelDataItems(
  content: ModelContent,
  replacements: ReadonlyMap<string, DataItemEntry>,
  mode: "existing-draft" | "new-draft",
) {
  let updated = 0;
  let needsReview = 0;
  let unitsChanged = false;
  const stages = content.stages.map((stage) => ({
    ...stage,
    categories: stage.categories.map((category) => ({
      ...category,
      items: category.items.map((item) => {
        const source = item.librarySource;
        if (!source) return item;
        const next = replacements.get(source.dataItemId);
        if (!next || next.version <= source.version) return item;
        if (
          mode === "existing-draft" &&
          !canUpdateModelDataItemDraft(item, next)
        ) {
          needsReview++;
          return item;
        }
        updated++;
        unitsChanged ||= next.functionalUnit !== item.functionalUnit;
        return modelItemFromCatalog(next, item.id);
      }),
    })),
  }));
  const draft = { ...content, stages };
  return {
    content: unitsChanged ? synchronizePvProfile(draft) : draft,
    updated,
    needsReview,
  };
}

export async function prepareSchoolTemplateCopy(
  tx: Prisma.TransactionClient,
  content: ModelContent,
) {
  const ids = [...referencedVersions(content).keys()];
  if (!ids.length) return content;
  // Block concurrent catalog publication until the new model's references are recorded.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "DataItem" WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR SHARE`,
  );
  const replacements = await findNewerModelDataItems(tx, content);
  return replacements.size
    ? upgradeModelDataItems(content, replacements, "new-draft").content
    : content;
}

// The caller holds the model lock, so changes use the latest committed version.
export async function upgradeModelVersionDataItems(
  tx: Prisma.TransactionClient,
  input: {
    model: Pick<FootprintModel, "id" | "code" | "scope" | "schoolId">;
    version: ModelVersion;
    actorId: string;
    replacements: ReadonlyMap<string, DataItemEntry>;
  },
): Promise<ModelDataItemChange | null> {
  const { model, version, actorId, replacements } = input;
  const createDraft = version.status === "PUBLISHED";
  const { content, updated, needsReview } = upgradeModelDataItems(
    modelContentSchema.parse(version.content),
    replacements,
    createDraft ? "new-draft" : "existing-draft",
  );
  if (!updated && !needsReview) return null;
  if (version.status === "SUBMITTED")
    return {
      scope: model.scope,
      createdDraft: false,
      updated: 0,
      needsReview: 0,
      awaitingReview: true,
    };

  let targetId = version.id;
  if (createDraft) {
    const draft = await createModelDraft(tx, {
      model,
      actorId,
      authorId: model.schoolId ? version.createdById : actorId,
      version: version.version + 1,
      content: content as Prisma.InputJsonValue,
    });
    targetId = draft.id;
  } else if (updated) {
    await tx.modelVersion.update({
      where: { id: version.id },
      data: {
        content: content as Prisma.InputJsonValue,
        updatedAt: new Date(
          Math.max(Date.now(), version.updatedAt.getTime() + 1),
        ),
      },
    });
    await recordModelDataItemUsage(tx, version.id, content);
  }
  if (updated) {
    const entries = [...replacements.values()];
    const [entry] = entries;
    await audit(tx, {
      actorId,
      schoolId: model.schoolId ?? undefined,
      action: "model.data-item.upgrade",
      targetType: "ModelVersion",
      targetId,
      details: {
        ...(entries.length === 1
          ? {
              dataItemVersionId: entry.id,
              code: entry.code,
              version: entry.version,
            }
          : { dataItemVersionIds: entries.map(({ id }) => id) }),
        createdDraft: createDraft,
        updated,
        needsReview,
      },
    });
  }
  return {
    scope: model.scope,
    createdDraft: createDraft,
    updated,
    needsReview,
    awaitingReview: false,
  };
}

export async function upgradeLinkedModels(
  tx: Prisma.TransactionClient,
  actorId: string,
  entry: DataItemEntry,
): Promise<ModelDataItemChange[]> {
  const replacements = new Map([[entry.dataItemId, entry]]);
  // Take model locks in ID order before reading their latest versions.
  // Usage includes past drafts, so the current content is checked separately.
  const linked = await tx.$queryRaw<{ id: string }[]>`
    SELECT model.id
    FROM "FootprintModel" AS model
    WHERE model."archivedAt" IS NULL AND EXISTS (
      SELECT 1
      FROM "DataItemVersion" AS item
      JOIN "DataItemUsage" AS usage ON usage."dataItemVersionId" = item.id
      JOIN "ModelVersion" AS version ON version.id = usage."modelVersionId"
      WHERE item."dataItemId" = ${entry.dataItemId}::uuid
        AND item.version < ${entry.version}
        AND version."modelId" = model.id
    )
    ORDER BY model.id
    FOR NO KEY UPDATE OF model
  `;
  if (!linked.length) return [];
  const models = await tx.footprintModel.findMany({
    where: { id: { in: linked.map(({ id }) => id) } },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const changes: ModelDataItemChange[] = [];
  for (const model of models) {
    const latest = model.versions[0];
    if (!latest) continue;
    const change = await upgradeModelVersionDataItems(tx, {
      model,
      version: latest,
      actorId,
      replacements,
    });
    if (change) changes.push(change);
  }
  return changes;
}
