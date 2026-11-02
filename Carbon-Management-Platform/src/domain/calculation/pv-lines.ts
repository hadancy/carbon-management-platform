import { z } from "zod";
import { canConvertUnit } from "@/shared/units";
import type { ModelContent } from "@/shared/models";
import { pvStages, type PvStage } from "@/shared/calculation-profile";
import { Exact, parseNonnegative, type ExactValue } from "./decimal";
import { selectFactor } from "./factor-selection";
import { convertUnit, type UnitConversion } from "./units";
import {
  diagnostic,
  type PvCalculationInput,
  type CalculatedLine,
  type CalculationDiagnostic,
} from "./pv-contract";

export function calculatePvLines(
  input: PvCalculationInput,
  content: ModelContent,
  gridEnergy: ExactValue,
) {
  const issues: CalculationDiagnostic[] = [];
  const profile = content.calculationProfile!;
  const stageMap = new Map(
    profile.stageMappings.map((item) => [item.stageId, item.calculationStage]),
  );
  const itemMap = new Map<
    string,
    {
      stage: PvStage;
      unit: string;
      role: "ACTIVITY" | "TRANSPORT" | "GRID_FACTOR";
      subject: string;
    }
  >();
  for (const stage of content.stages)
    for (const category of stage.categories)
      for (const item of category.items) {
        const mapping = profile.itemMappings.find(
          (entry) => entry.itemId === item.id,
        )!;
        itemMap.set(item.id, {
          stage: stageMap.get(stage.id)!,
          unit: mapping.factorActivityUnit,
          role: mapping.role,
          subject: item.dataName,
        });
      }
  const seen = new Set<string>();
  const stageTotals = Object.fromEntries(
    pvStages.map((stage) => [stage, new Exact(0)]),
  ) as Record<PvStage, InstanceType<typeof Exact>>;
  const calculated: CalculatedLine[] = [];
  for (const [index, line] of input.lines.entries()) {
    const path = `lines.${index}`;
    const mapping = itemMap.get(line.itemId);
    if (!mapping || seen.has(line.itemId)) {
      issues.push(
        diagnostic(
          `${path}.itemId`,
          "PV-01",
          "UNKNOWN_OR_DUPLICATE_ITEM",
          "模型数据项不存在或重复",
        ),
      );
      continue;
    }
    seen.add(line.itemId);
    if (line.state === "NOT_APPLICABLE") {
      if (!line.reason?.trim() || mapping.role === "GRID_FACTOR")
        issues.push(
          diagnostic(
            path,
            "PV-03",
            "INVALID_NOT_APPLICABLE",
            "不适用项须说明理由；并网输配电因子不能标为不适用",
          ),
        );
      else
        calculated.push({
          itemId: line.itemId,
          stage: mapping.stage,
          factorVersionId: null,
          conversions: [],
          normalizedActivity: "0",
          emissionsKg: "0",
        });
      continue;
    }
    if (line.state !== "RECORDED") {
      issues.push(
        diagnostic(
          `${path}.state`,
          "PV-03",
          "MISSING_STATE",
          "须明确数据项已录入或不适用",
        ),
      );
      continue;
    }
    const selected = selectFactor(
      input.factors.find((factor) => factor.id === line.factorVersionId),
      {
        ...mapping,
        referenceDate:
          mapping.role === "GRID_FACTOR"
            ? input.referenceDate
            : (line.activityDate ?? ""),
        region: input.region,
        technology: input.technology,
        mode: input.mode,
      },
    );
    if (selected.problem)
      issues.push(
        diagnostic(
          `${path}.factorVersionId`,
          "PV-05",
          selected.problem.code,
          selected.problem.message,
        ),
      );
    if (!line.evidence?.trim() && mapping.role !== "GRID_FACTOR")
      issues.push(
        diagnostic(
          `${path}.evidence`,
          "PV-03",
          "MISSING_EVIDENCE",
          "活动数据须记录证据",
        ),
      );
    if (
      mapping.role !== "GRID_FACTOR" &&
      !z.iso.date().safeParse(line.activityDate).success
    )
      issues.push(
        diagnostic(
          `${path}.activityDate`,
          "PV-03",
          "MISSING_ACTIVITY_DATE",
          "活动数据须记录发生日期，以核对因子适用期",
        ),
      );
    let amount: InstanceType<typeof Exact> | null = null;
    const conversions: UnitConversion[] = [];
    if (mapping.role === "GRID_FACTOR") amount = gridEnergy;
    else if (mapping.role === "TRANSPORT") {
      const weight = convertUnit(line.weight, line.weightUnit ?? "", "t");
      const distance = convertUnit(
        line.distance,
        line.distanceUnit ?? "",
        "km",
      );
      if (!weight || !distance)
        issues.push(
          diagnostic(
            path,
            "PV-06",
            "INVALID_TRANSPORT",
            "运输须填写可换算为吨和公里的重量、距离",
          ),
        );
      else {
        amount = weight.amount.mul(distance.amount);
        conversions.push(weight.trace, distance.trace);
      }
    } else {
      const converted = convertUnit(line.value, line.unit ?? "", mapping.unit);
      if (!converted)
        issues.push(
          diagnostic(
            `${path}.${canConvertUnit(line.unit ?? "", mapping.unit) ? "value" : "unit"}`,
            mapping.stage === "RS"
              ? "PV-05"
              : mapping.stage === "CS"
                ? "PV-07"
                : "PV-08",
            "INVALID_ACTIVITY",
            canConvertUnit(line.unit ?? "", mapping.unit)
              ? "活动数量须为非负数"
              : `活动单位须能换算为 ${mapping.unit}`,
          ),
        );
      else {
        amount = converted.amount;
        conversions.push(converted.trace);
      }
    }
    if (amount?.eq(0) && !line.reason?.trim() && mapping.role !== "GRID_FACTOR")
      issues.push(
        diagnostic(
          `${path}.reason`,
          "PV-03",
          "ZERO_REASON",
          "明确的零活动量须说明原因",
        ),
      );
    if (amount && selected.factor) {
      const factorValue = parseNonnegative(selected.factor.value)!;
      const emissions = amount.mul(factorValue);
      stageTotals[mapping.stage] = stageTotals[mapping.stage].plus(emissions);
      calculated.push({
        itemId: line.itemId,
        stage: mapping.stage,
        factorVersionId: line.factorVersionId!,
        conversions,
        normalizedActivity: amount.toString(),
        emissionsKg: emissions.toString(),
      });
    }
  }
  for (const id of itemMap.keys())
    if (!seen.has(id))
      issues.push(
        diagnostic(
          `lines.${id}`,
          "PV-03",
          "MISSING_ITEM",
          "模型数据项尚未录入或声明不适用",
        ),
      );
  return { stageTotals, calculated, issues };
}
