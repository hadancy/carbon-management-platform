import { z } from "zod";
import { modelItemSourceSchema } from "./model-data-items";
import {
  calculationProfileSchema,
  validatePvCalculationProfile,
} from "./calculation-profile";
import {
  canonicalUnitCode,
  factorUnitLabel,
  isKnownUnit,
  isNumericFactor,
} from "./units";

const text = (max: number) => z.string().trim().max(max);

export const modelItemSchema = z.object({
  id: z.uuid(),
  dataName: text(200),
  specModel: text(200),
  manufacturer: text(200),
  carbonFootprintFactor: text(120),
  functionalUnit: text(120),
  emissionFactor: text(120),
  factorSource: text(300),
  dataSource: text(300),
  librarySource: modelItemSourceSchema.optional(),
});

export const modelCategorySchema = z.object({
  id: z.uuid(),
  name: text(120),
  items: z.array(modelItemSchema).max(300),
});

export const modelStageSchema = z.object({
  id: z.uuid(),
  name: text(120),
  categories: z.array(modelCategorySchema).max(100),
});

export const modelContentSchema = z.object({
  name: text(200),
  functionalQuantity: z.number().finite().nullable().default(1),
  functionalUnit: text(120),
  functionalDescription: text(120).default(""),
  boundary: text(200),
  boundaryDiagram: z
    .string()
    .max(3_000_000)
    .refine(
      (value) =>
        !value ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
      "系统边界示意图仅支持 PNG、JPG 或 WebP",
    ),
  referenceStandard: text(500),
  description: text(2000),
  stages: z.array(modelStageSchema).max(100),
  calculationProfile: calculationProfileSchema.optional(),
});

export type ModelContent = z.infer<typeof modelContentSchema>;
export type ModelStage = ModelContent["stages"][number];
export type ModelCategory = ModelStage["categories"][number];
export type ModelItem = ModelCategory["items"][number];

export const emptyModelContent = (): ModelContent => ({
  name: "",
  functionalQuantity: 1,
  functionalUnit: "",
  functionalDescription: "",
  boundary: "",
  boundaryDiagram: "",
  referenceStandard: "",
  description: "",
  stages: [],
});

export function normalizeLegacyModelContent(content: ModelContent) {
  const normalized = structuredClone(content);
  let convertedFactors = 0;
  let convertedUnits = 0;

  const modelUnit = canonicalUnitCode(normalized.functionalUnit);
  if (modelUnit !== normalized.functionalUnit) {
    normalized.functionalUnit = modelUnit;
    convertedUnits++;
  }

  for (const stage of normalized.stages) {
    for (const category of stage.categories) {
      for (const item of category.items) {
        const unit = canonicalUnitCode(item.functionalUnit);
        if (unit !== item.functionalUnit) {
          item.functionalUnit = unit;
          convertedUnits++;
        }
        if (!isKnownUnit(unit) || isNumericFactor(item.emissionFactor))
          continue;
        const match =
          /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s+(.+)$/u.exec(
            item.emissionFactor.trim(),
          );
        if (!match) continue;
        const expected = factorUnitLabel(unit)
          .replaceAll("₂", "2")
          .replace(/\s/g, "");
        const actual = match[2].replaceAll("₂", "2").replace(/\s/g, "");
        if (isNumericFactor(match[1]) && actual === expected) {
          item.emissionFactor = match[1];
          convertedFactors++;
        }
      }
    }
  }

  return { content: normalized, convertedFactors, convertedUnits };
}

export function validatePublishableModel(content: ModelContent): string | null {
  if (
    !content.name.trim() ||
    !content.functionalUnit.trim() ||
    !content.boundary.trim() ||
    !content.referenceStandard.trim()
  )
    return "请填写模型名称、功能单位、系统边界和引用标准";
  if (!isKnownUnit(content.functionalUnit))
    return "模型功能单位须从单位列表中选择";
  if (content.functionalQuantity === null || content.functionalQuantity <= 0)
    return "模型功能单位数量须大于 0";
  if (!content.stages.length) return "请至少添加一个生命周期阶段";
  const ids = new Set<string>();
  for (const stage of content.stages) {
    if (!stage.name.trim()) return "阶段名称不能为空";
    if (ids.has(stage.id)) return "模型中存在重复的阶段或数据项标识";
    ids.add(stage.id);
    if (!stage.categories.length)
      return `阶段「${stage.name}」需要至少一个大类`;
    for (const category of stage.categories) {
      if (!category.name.trim()) return "大类名称不能为空";
      if (ids.has(category.id)) return "模型中存在重复的阶段或数据项标识";
      ids.add(category.id);
      if (!category.items.length)
        return `大类「${category.name}」需要至少一个数据项`;
      for (const item of category.items) {
        if (!item.dataName.trim() || !item.functionalUnit.trim())
          return "每个数据项都需要填写数据名称和活动数据单位";
        if (!isKnownUnit(item.functionalUnit))
          return `数据项「${item.dataName}」的活动数据单位须从单位列表中选择`;
        if (item.emissionFactor && !isNumericFactor(item.emissionFactor))
          return `数据项「${item.dataName}」的排放因子无法识别，请核对是否为 ${factorUnitLabel(item.functionalUnit)}，或只填写数值`;
        if (ids.has(item.id)) return "模型中存在重复的阶段或数据项标识";
        ids.add(item.id);
      }
    }
  }
  if (content.calculationProfile) return validatePvCalculationProfile(content);
  return null;
}
