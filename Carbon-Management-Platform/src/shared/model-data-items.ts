import { z } from "zod";
import { dataItemFields, type DataItemEntry } from "./data-items";
import type { ModelItem } from "./models";

export const modelItemSourceSchema = z
  .object({
    dataItemId: z.uuid(),
    versionId: z.uuid(),
    code: z.string().min(2).max(80),
    version: z.number().int().positive(),
  })
  .strict();

export function modelItemFromCatalog(
  entry: DataItemEntry,
  id: string,
): ModelItem {
  return {
    id,
    ...dataItemFields(entry),
    librarySource: {
      dataItemId: entry.dataItemId,
      versionId: entry.id,
      code: entry.code,
      version: entry.version,
    },
  };
}

export function selectModelDataItems(
  items: ModelItem[],
  entries: DataItemEntry[],
  createId: () => string,
  replacingId?: string,
): ModelItem[] {
  if (!entries.length || (replacingId && entries.length !== 1))
    throw new Error("请选择要使用的数据项版本");
  if (replacingId && !items.some((item) => item.id === replacingId))
    throw new Error("需要更换的数据项已移除，请重新选择");
  const identities = new Set(
    items
      .filter((item) => item.id !== replacingId)
      .map((item) => item.librarySource?.dataItemId)
      .filter(Boolean),
  );
  for (const entry of entries) {
    if (identities.has(entry.dataItemId))
      throw new Error(
        `当前大类已包含数据项「${entry.dataName}」，不能重复添加`,
      );
    identities.add(entry.dataItemId);
  }
  if (replacingId)
    return items.map((item) =>
      item.id === replacingId
        ? modelItemFromCatalog(entries[0], item.id)
        : item,
    );
  if (items.length + entries.length > 300)
    throw new Error("每个大类最多添加 300 个数据项");
  return [
    ...items,
    ...entries.map((entry) => modelItemFromCatalog(entry, createId())),
  ];
}
