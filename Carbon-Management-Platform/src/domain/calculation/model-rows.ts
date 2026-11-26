import type { ModelContent } from "@/shared/models";

export function modelRows(content: ModelContent) {
  const profile = content.calculationProfile;
  if (!profile) return [];
  const stages = new Map(
    profile.stageMappings.map((item) => [item.stageId, item.calculationStage]),
  );
  const items = new Map(
    profile.itemMappings.map((item) => [item.itemId, item]),
  );
  return content.stages.flatMap((stage) =>
    stage.categories.flatMap((category) =>
      category.items.map((item) => {
        const mapping = items.get(item.id);
        return {
          id: item.id,
          name: item.dataName,
          stage: stages.get(stage.id) ?? "",
          role: mapping?.role ?? "ACTIVITY",
          unit: mapping?.factorActivityUnit ?? item.functionalUnit,
          modelFactor: item.emissionFactor,
        };
      }),
    ),
  );
}

export type ModelRow = ReturnType<typeof modelRows>[number];
