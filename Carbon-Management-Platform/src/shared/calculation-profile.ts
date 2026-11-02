import { z } from "zod";
import { isKnownUnit } from "./units";

export const pvStages = ["RS", "TR", "CS", "US", "TD"] as const;
export type PvStage = (typeof pvStages)[number];

export const calculationProfileSchema = z.object({
  product: z.literal("PV"),
  formula: z.literal("PV_GRID_V1"),
  stageMappings: z.array(
    z.object({
      stageId: z.uuid(),
      calculationStage: z.enum(pvStages),
    }),
  ),
  itemMappings: z.array(
    z.object({
      itemId: z.uuid(),
      role: z.enum(["ACTIVITY", "TRANSPORT", "GRID_FACTOR"]),
      factorActivityUnit: z.string().refine(isKnownUnit),
    }),
  ),
});

export type CalculationProfile = z.infer<typeof calculationProfileSchema>;

export function synchronizePvProfile<
  T extends {
    stages: {
      id: string;
      categories: { items: { id: string; functionalUnit: string }[] }[];
    }[];
    calculationProfile?: CalculationProfile;
  },
>(content: T): T {
  if (!content.calculationProfile) return content;
  const stages = content.stages;
  const stageMappings = content.calculationProfile.stageMappings.filter(
    (mapping) => stages.some((stage) => stage.id === mapping.stageId),
  );
  const codeByStage = new Map(
    stageMappings.map((mapping) => [mapping.stageId, mapping.calculationStage]),
  );
  const itemMappings = stages.flatMap((stage) => {
    const code = codeByStage.get(stage.id);
    if (!code) return [];
    return stage.categories.flatMap((category) =>
      category.items.map((item) => ({
        itemId: item.id,
        role:
          code === "TR"
            ? ("TRANSPORT" as const)
            : code === "TD"
              ? ("GRID_FACTOR" as const)
              : ("ACTIVITY" as const),
        factorActivityUnit:
          code === "TR" ? "t_km" : code === "TD" ? "kWh" : item.functionalUnit,
      })),
    );
  });
  return {
    ...content,
    calculationProfile: {
      ...content.calculationProfile,
      stageMappings,
      itemMappings,
    },
  };
}

type ModelStructure = {
  functionalQuantity: number | null;
  functionalUnit: string;
  stages: {
    id: string;
    categories: { items: { id: string; functionalUnit: string }[] }[];
  }[];
  calculationProfile?: CalculationProfile;
};

export function validatePvCalculationProfile(
  content: ModelStructure,
): string | null {
  const parsed = calculationProfileSchema.safeParse(content.calculationProfile);
  if (!parsed.success) return "模型缺少有效的光伏计算映射";
  if (content.functionalQuantity !== 1 || content.functionalUnit !== "kWh")
    return "光伏模型的功能单位须为 1 kWh";
  const profile = parsed.data;
  const stageIds = new Set(content.stages.map((stage) => stage.id));
  const mappedStages = new Set<string>();
  const stageCodes = new Set<PvStage>();
  for (const mapping of profile.stageMappings) {
    if (!stageIds.has(mapping.stageId) || mappedStages.has(mapping.stageId))
      return "计算阶段映射包含无效或重复的阶段 ID";
    mappedStages.add(mapping.stageId);
    stageCodes.add(mapping.calculationStage);
  }
  if (
    mappedStages.size !== stageIds.size ||
    stageCodes.size !== pvStages.length
  )
    return "光伏计算映射须覆盖全部模型阶段及五个计算阶段";
  const stageById = new Map(
    profile.stageMappings.map((item) => [item.stageId, item.calculationStage]),
  );
  const itemStage = new Map<string, PvStage>();
  const itemUnit = new Map<string, string>();
  for (const stage of content.stages)
    for (const category of stage.categories)
      for (const item of category.items) {
        itemStage.set(item.id, stageById.get(stage.id)!);
        itemUnit.set(item.id, item.functionalUnit);
      }
  const mappedItems = new Set<string>();
  let gridFactors = 0;
  for (const mapping of profile.itemMappings) {
    const stage = itemStage.get(mapping.itemId);
    if (!stage || mappedItems.has(mapping.itemId))
      return "计算数据项映射包含无效或重复的 ID";
    mappedItems.add(mapping.itemId);
    if (
      stage === "TR"
        ? mapping.role !== "TRANSPORT" ||
          mapping.factorActivityUnit !== "t_km" ||
          itemUnit.get(mapping.itemId) !== "t_km"
        : stage === "TD"
          ? mapping.role !== "GRID_FACTOR" ||
            mapping.factorActivityUnit !== "kWh" ||
            itemUnit.get(mapping.itemId) !== "kWh"
          : mapping.role !== "ACTIVITY" ||
            mapping.factorActivityUnit !== itemUnit.get(mapping.itemId)
    )
      return `数据项 ${mapping.itemId} 的计算角色或因子分母与阶段不匹配`;
    if (mapping.role === "GRID_FACTOR") gridFactors++;
  }
  if (mappedItems.size !== itemStage.size || gridFactors !== 1)
    return "全部模型数据项都须映射，且须有且仅有一条输配电因子项";
  return null;
}
