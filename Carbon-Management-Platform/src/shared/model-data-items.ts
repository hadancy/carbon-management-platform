import { z } from "zod";
import {
  dataItemFields,
  sameDataItemFields,
  type DataItemEntry,
  type DataItemFields,
} from "./data-items";
import type { ModelItem } from "./models";
import { factorUnitLabel, isNumericFactor } from "./units";

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

function isPlainCarbonFootprintFactor(value: string, activityUnit: string) {
  if (!value || isNumericFactor(value)) return true;
  const factor = value.replaceAll("₂", "2");
  const unit = factorUnitLabel(activityUnit).replaceAll("₂", "2");
  return (
    factor.endsWith(unit) && isNumericFactor(factor.slice(0, -unit.length))
  );
}

export function canUpdateModelDataItemDraft(
  previous: DataItemFields,
  next: DataItemFields,
) {
  if (
    !sameDataItemFields(
      {
        ...previous,
        emissionFactor: next.emissionFactor,
        carbonFootprintFactor: next.carbonFootprintFactor,
      },
      next,
    )
  )
    return false;
  return (
    previous.carbonFootprintFactor === next.carbonFootprintFactor ||
    (isPlainCarbonFootprintFactor(
      previous.carbonFootprintFactor,
      previous.functionalUnit,
    ) &&
      isPlainCarbonFootprintFactor(
        next.carbonFootprintFactor,
        next.functionalUnit,
      ))
  );
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
