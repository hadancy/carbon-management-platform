import type { ModelContent } from "@/shared/models";
import type { PvStage } from "@/shared/calculation-profile";
import type { FactorVersionSnapshot } from "@/shared/emission-factors";
import type { AnnualEnergy } from "./energy";
import type { UnitConversion } from "./units";

export type ActivityLine = {
  itemId: string;
  state: "RECORDED" | "NOT_APPLICABLE";
  reason?: string;
  factorVersionId?: string;
  value?: string;
  unit?: string;
  weight?: string;
  weightUnit?: string;
  distance?: string;
  distanceUnit?: string;
  evidence?: string;
  activityDate?: string;
};

export type PvCalculationInput = {
  mode: "TRIAL" | "PRODUCTION";
  scenario: "GRID_ONLY" | "DIRECT_ONLY" | "MIXED";
  model: {
    id: string;
    scope: "SCHOOL" | "PUBLIC";
    status: "PUBLISHED" | "DRAFT";
    content: ModelContent;
  };
  factors: FactorVersionSnapshot[];
  referenceDate: string;
  region: string;
  technology: string;
  lines: ActivityLine[];
  operatingYears: number;
  annualEnergy: AnnualEnergy[];
  directSupplyKwh: string;
  lossRatio: string;
  transmissionMethod: "GRID_FACTOR_FALLBACK" | "SF6_ACTUAL";
  transmissionFallbackReason: string;
};

export type CalculationDiagnostic = {
  path: string;
  ruleId: string;
  code: string;
  message: string;
  suggestion: string;
};

export type CalculatedLine = {
  itemId: string;
  stage: PvStage;
  factorVersionId: string | null;
  conversions: UnitConversion[];
  normalizedActivity: string;
  emissionsKg: string;
};

export type PvCalculationResult = {
  engineVersion: "pv-grid-1.0.0";
  mode: PvCalculationInput["mode"];
  stagesKg: Record<PvStage, string>;
  lines: CalculatedLine[];
  totalEmissionsKg: string;
  gridEnergyKwh: string;
  deliveredEnergyKwh: string;
  footprintKgPerKwh: string;
  display: {
    stagesKg: Record<PvStage, string>;
    stagesBelowDisplayPrecision: Record<PvStage, boolean>;
    totalEmissionsKg: string;
    totalBelowDisplayPrecision: boolean;
    gridEnergyKwh: string;
    energyBelowDisplayPrecision: boolean;
    footprintKgPerKwh: string;
    belowDisplayPrecision: boolean;
  };
};

export function diagnostic(
  path: string,
  ruleId: string,
  code: string,
  message: string,
  suggestion = "请核对输入并补齐所需资料",
): CalculationDiagnostic {
  return { path, ruleId, code, message, suggestion };
}
