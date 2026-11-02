import { z } from "zod";
import { modelContentSchema } from "@/shared/models";
import {
  pvStages,
  validatePvCalculationProfile,
  type PvStage,
} from "@/shared/calculation-profile";
import { Exact, displayDecimal, parseNonnegative, parseRatio } from "./decimal";
import { sumAnnualEnergy } from "./energy";
import { calculatePvLines } from "./pv-lines";
import {
  diagnostic,
  type PvCalculationInput,
  type PvCalculationResult,
  type CalculationDiagnostic,
} from "./pv-contract";

export type {
  PvCalculationInput,
  PvCalculationResult,
  ActivityLine,
  CalculatedLine,
  CalculationDiagnostic,
} from "./pv-contract";

export function calculatePv(
  input: PvCalculationInput,
):
  | { ok: true; result: PvCalculationResult; diagnostics: [] }
  | { ok: false; result: null; diagnostics: CalculationDiagnostic[] } {
  const issues: CalculationDiagnostic[] = [];
  if (input.scenario !== "GRID_ONLY")
    return {
      ok: false,
      result: null,
      diagnostics: [
        diagnostic(
          "scenario",
          "PV-11",
          "SCENARIO_DISABLED",
          "纯直供与混合供电计算尚未启用",
          "请选择并网场景，或等待相应规则通过业务确认",
        ),
      ],
    };
  if (input.model.status !== "PUBLISHED" || input.model.scope !== "SCHOOL")
    issues.push(
      diagnostic(
        "model",
        "PV-01",
        "MODEL_NOT_ELIGIBLE",
        "只能引用本校已发布模型版本",
      ),
    );
  const model = modelContentSchema.safeParse(input.model.content);
  const profileProblem = model.success
    ? validatePvCalculationProfile(model.data)
    : "模型内容无效";
  if (profileProblem)
    issues.push(
      diagnostic(
        "model.content.calculationProfile",
        "PV-01",
        "INVALID_MODEL_MAPPING",
        profileProblem,
      ),
    );
  const energy = sumAnnualEnergy(input.operatingYears, input.annualEnergy);
  for (const problem of energy.problems)
    issues.push(
      diagnostic(problem.path, "PV-10", problem.code, problem.message),
    );
  const direct = parseNonnegative(input.directSupplyKwh);
  if (!direct || !direct.eq(0))
    issues.push(
      diagnostic(
        "directSupplyKwh",
        "PV-11",
        "INVALID_DIRECT_SUPPLY",
        "并网场景的直供电量须明确为 0",
      ),
    );
  const loss = parseRatio(input.lossRatio, true, false);
  if (!loss)
    issues.push(
      diagnostic(
        "lossRatio",
        "PV-11",
        "INVALID_LOSS_RATIO",
        "线损率须为 0 到 1 之间的比例字符串，不含 1",
      ),
    );
  if (!energy.total.gt(0))
    issues.push(
      diagnostic(
        "annualEnergy",
        "PV-11",
        "ZERO_GRID_ENERGY",
        "并网场景的生命周期上网电量须大于 0",
      ),
    );
  if (
    input.transmissionMethod !== "GRID_FACTOR_FALLBACK" ||
    !input.transmissionFallbackReason?.trim()
  )
    issues.push(
      diagnostic(
        "transmissionMethod",
        "PV-09",
        "METHOD_NOT_READY",
        "简化法须说明 SF₆ 数据难以取得的理由；实测法尚未启用",
      ),
    );
  if (!z.iso.date().safeParse(input.referenceDate).success)
    issues.push(
      diagnostic(
        "referenceDate",
        "PV-03",
        "INVALID_DATE",
        "核算日期须为 YYYY-MM-DD",
      ),
    );
  if (!input.region?.trim() || !input.technology?.trim())
    issues.push(
      diagnostic("region", "PV-03", "MISSING_CONTEXT", "须填写地域和技术信息"),
    );
  if (!model.success || profileProblem)
    return { ok: false, result: null, diagnostics: issues };

  const lineResult = calculatePvLines(input, model.data, energy.total);
  issues.push(...lineResult.issues);
  const { stageTotals, calculated } = lineResult;
  if (issues.length) return { ok: false, result: null, diagnostics: issues };
  const total = pvStages.reduce(
    (sum, stage) => sum.plus(stageTotals[stage]),
    new Exact(0),
  );
  const delivered = energy.total.mul(new Exact(1).minus(loss!));
  const footprint = total.div(delivered);
  const displayFootprint = displayDecimal(footprint, 6);
  const displayTotal = displayDecimal(total, 2);
  const displayEnergy = displayDecimal(energy.total, 2);
  const stagesKg = Object.fromEntries(
    pvStages.map((stage) => [stage, stageTotals[stage].toString()]),
  ) as Record<PvStage, string>;
  const displayStages = Object.fromEntries(
    pvStages.map((stage) => [
      stage,
      displayDecimal(stageTotals[stage], 2).value,
    ]),
  ) as Record<PvStage, string>;
  const displayStageFlags = Object.fromEntries(
    pvStages.map((stage) => [
      stage,
      displayDecimal(stageTotals[stage], 2).belowDisplayPrecision,
    ]),
  ) as Record<PvStage, boolean>;
  return {
    ok: true,
    diagnostics: [],
    result: {
      engineVersion: "pv-grid-1.0.0",
      mode: input.mode,
      stagesKg,
      lines: calculated,
      totalEmissionsKg: total.toString(),
      gridEnergyKwh: energy.total.toString(),
      deliveredEnergyKwh: delivered.toString(),
      footprintKgPerKwh: footprint.toString(),
      display: {
        stagesKg: displayStages,
        stagesBelowDisplayPrecision: displayStageFlags,
        totalEmissionsKg: displayTotal.value,
        totalBelowDisplayPrecision: displayTotal.belowDisplayPrecision,
        gridEnergyKwh: displayEnergy.value,
        energyBelowDisplayPrecision: displayEnergy.belowDisplayPrecision,
        footprintKgPerKwh: displayFootprint.value,
        belowDisplayPrecision: displayFootprint.belowDisplayPrecision,
      },
    },
  };
}
