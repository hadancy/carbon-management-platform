import { Exact } from "@/domain/calculation/decimal";
import { pvStages } from "@/shared/calculation-profile";
import type { PvCalculationResult } from "@/domain/calculation/pv";
import type { PvAcceptanceBundle } from "./pv-contract";

export type AcceptanceComparison = {
  path: string;
  expected: string;
  actual: string | null;
  difference: string | null;
  passed: boolean;
};

export function comparePvResult(
  expected: PvAcceptanceBundle["expected"],
  result: PvCalculationResult,
) {
  const problems: string[] = [];
  const comparisons: AcceptanceComparison[] = [];
  function compare(
    path: string,
    reference: string,
    actual: string | undefined,
    display = false,
  ) {
    const difference =
      actual === undefined
        ? null
        : new Exact(actual).minus(reference).abs().toString();
    comparisons.push({
      path,
      expected: reference,
      actual: actual ?? null,
      difference,
      passed:
        actual !== undefined &&
        (display
          ? actual === reference
          : new Exact(difference!).lte(expected.absoluteTolerance)),
    });
  }
  const referenceIds = new Set(expected.lines.map((line) => line.itemId));
  if (
    referenceIds.size !== expected.lines.length ||
    referenceIds.size !== result.lines.length ||
    result.lines.some((line) => !referenceIds.has(line.itemId))
  )
    problems.push("独立预期必须逐项覆盖模型，且数据项编号不能重复");
  for (const line of expected.lines) {
    const actual = result.lines.find((item) => item.itemId === line.itemId);
    compare(
      `lines.${line.itemId}.normalizedActivity`,
      line.normalizedActivity,
      actual?.normalizedActivity,
    );
    compare(
      `lines.${line.itemId}.emissionsKg`,
      line.emissionsKg,
      actual?.emissionsKg,
    );
  }
  for (const stage of pvStages) {
    compare(
      `stagesKg.${stage}`,
      expected.stagesKg[stage],
      result.stagesKg[stage],
    );
    compare(
      `display.stagesKg.${stage}`,
      expected.display.stagesKg[stage],
      result.display.stagesKg[stage],
      true,
    );
  }
  for (const key of [
    "totalEmissionsKg",
    "gridEnergyKwh",
    "deliveredEnergyKwh",
    "footprintKgPerKwh",
  ] as const)
    compare(key, expected[key], result[key]);
  for (const key of [
    "totalEmissionsKg",
    "gridEnergyKwh",
    "footprintKgPerKwh",
  ] as const)
    compare(`display.${key}`, expected.display[key], result.display[key], true);
  return { comparisons, problems };
}
