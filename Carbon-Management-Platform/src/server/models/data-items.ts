import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { RequestError } from "@/server/http/response";
import { toDataItemEntry } from "@/server/data-items/queries";
import { sameDataItemFields } from "@/shared/data-items";
import { modelItemFromCatalog } from "@/shared/model-data-items";
import {
  normalizeLegacyModelContent,
  type ModelContent,
  type ModelItem,
} from "@/shared/models";

const modelItems = (content: ModelContent) =>
  content.stages.flatMap((stage) =>
    stage.categories.flatMap((category) => category.items),
  );

/** New selections resolve from the library; saved occurrences retain frozen snapshots. */
export async function resolveModelDataItems(
  tx: Prisma.TransactionClient,
  content: ModelContent,
  previous?: ModelContent,
): Promise<ModelContent> {
  const resolved = structuredClone(content);
  const previousItems = new Map(
    previous ? modelItems(previous).map((item) => [item.id, item]) : [],
  );
  const normalizedPrevious = new Map(
    previous
      ? modelItems(normalizeLegacyModelContent(previous).content).map(
          (item) => [item.id, item],
        )
      : [],
  );
  const pending: ModelItem[] = [];
  const ids = new Set<string>();
  function remember(id: string) {
    if (ids.has(id))
      throw new RequestError("模型中存在重复的阶段、大类或数据项标识", 400);
    ids.add(id);
  }
  for (const stage of resolved.stages) {
    remember(stage.id);
    for (const category of stage.categories) {
      remember(category.id);
      const identities = new Set<string>();
      for (const item of category.items) {
        remember(item.id);
        const old = previousItems.get(item.id);
        if (item.librarySource) {
          if (identities.has(item.librarySource.dataItemId))
            throw new RequestError(
              `大类「${category.name}」不能重复引用同一公共数据项`,
              400,
            );
          identities.add(item.librarySource.dataItemId);
          if (old?.librarySource?.versionId === item.librarySource.versionId) {
            if (
              old.librarySource.dataItemId !== item.librarySource.dataItemId ||
              old.librarySource.code !== item.librarySource.code ||
              old.librarySource.version !== item.librarySource.version ||
              !sameDataItemFields(old, item)
            )
              throw new RequestError(
                `数据项「${old.dataName}」的公共资料只读，请从库中更换版本`,
                400,
              );
          } else pending.push(item);
        } else {
          const normalized = normalizedPrevious.get(item.id);
          if (
            !old ||
            old.librarySource ||
            (!sameDataItemFields(old, item) &&
              (!normalized || !sameDataItemFields(normalized, item)))
          )
            throw new RequestError(
              "新增数据项须从公共数据项库选择；旧数据项可保留原资料或更换为公共库版本",
              400,
            );
        }
      }
    }
  }
  if (!pending.length) return resolved;
  const versionIds = [
    ...new Set(pending.map((item) => item.librarySource!.versionId)),
  ].sort();
  // Lock new references against concurrent retirement, then check availability.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "DataItemVersion" WHERE "id" IN (${Prisma.join(versionIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR SHARE`,
  );
  const versions = await tx.dataItemVersion.findMany({
    where: { id: { in: versionIds }, status: "PUBLISHED", retiredAt: null },
    include: { dataItem: { select: { code: true } } },
  });
  const byId = new Map(versions.map((version) => [version.id, version]));
  for (const item of pending) {
    const source = item.librarySource!;
    const version = byId.get(source.versionId);
    if (!version)
      throw new RequestError(
        `数据项「${item.dataName}」的公共库版本不存在、未发布或已停用，请重新选择`,
        400,
      );
    if (
      version.dataItemId !== source.dataItemId ||
      version.version !== source.version ||
      version.dataItem.code !== source.code
    )
      throw new RequestError("公共数据项版本来源不匹配，请重新选择", 400);
    Object.assign(
      item,
      modelItemFromCatalog(toDataItemEntry(version), item.id),
    );
  }
  return resolved;
}
