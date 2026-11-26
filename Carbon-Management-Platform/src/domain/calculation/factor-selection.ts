import { z } from "zod";
import {
  calculationFactorSchema,
  type CalculationFactor,
  type FactorVersionSnapshot,
} from "@/shared/emission-factors";
export type FactorProblem = { code: string; message: string };

type FactorRange = Pick<
  CalculationFactor["applicability"],
  "stage" | "subject" | "region" | "technology" | "validFrom" | "validTo"
>;

export type FactorDetails = Pick<
  CalculationFactor,
  "purpose" | "activityUnit"
> & {
  applicability: FactorRange;
};

type FactorItem = { stage: string; unit: string; subject: string };
type FactorTarget = FactorItem & {
  region: string;
  technology: string;
  referenceDate?: string;
  mode: "TRIAL" | "PRODUCTION";
};

const isoDate = z.iso.date();

export function factorMatchesItem(factor: FactorDetails, item: FactorItem) {
  const area = factor.applicability;
  return (
    area.stage === item.stage &&
    factor.activityUnit === item.unit &&
    (area.subject === "ALL" || area.subject === item.subject)
  );
}

export function factorDateMatch(factor: FactorDetails, date?: string) {
  const parsed = isoDate.safeParse(date);
  if (!parsed.success) return "PENDING";
  const { validFrom, validTo } = factor.applicability;
  return parsed.data < validFrom || parsed.data > validTo ? "OUTSIDE" : "MATCH";
}

export function factorApplicabilityProblem(
  factor: FactorDetails,
  expected: FactorTarget,
): FactorProblem | null {
  const area = factor.applicability;
  if (expected.mode === "PRODUCTION" && factor.purpose !== "PRODUCTION")
    return { code: "TEST_FACTOR", message: "测试因子不能用于正式计算" };
  if (!factorMatchesItem(factor, expected))
    return {
      code: "FACTOR_MISMATCH",
      message: "因子的阶段、对象或分母单位不匹配",
    };
  if (
    (area.region !== "ALL" && area.region !== expected.region) ||
    (area.technology !== "ALL" && area.technology !== expected.technology)
  )
    return { code: "FACTOR_SCOPE", message: "因子地域或技术适用范围不匹配" };
  const date = factorDateMatch(factor, expected.referenceDate);
  if (date === "PENDING")
    return { code: "FACTOR_DATE_REQUIRED", message: "请选择有效的核对日期" };
  if (date === "OUTSIDE")
    return { code: "FACTOR_EXPIRED", message: "核对日期超出因子适用期" };
  return null;
}

export function selectFactor(
  snapshot: FactorVersionSnapshot | undefined,
  expected: FactorTarget,
): { factor: CalculationFactor | null; problem: FactorProblem | null } {
  if (!snapshot)
    return {
      factor: null,
      problem: { code: "MISSING_FACTOR", message: "缺少因子版本" },
    };
  if (
    snapshot.type !== "EMISSION_FACTOR" ||
    snapshot.status !== "PUBLISHED" ||
    snapshot.retiredAt
  )
    return {
      factor: null,
      problem: { code: "INACTIVE_FACTOR", message: "因子未发布或已停用" },
    };
  const parsed = calculationFactorSchema.safeParse(snapshot.content);
  if (!parsed.success)
    return {
      factor: null,
      problem: {
        code: "LEGACY_FACTOR",
        message: "因子缺少 v2 计算字段，请复制旧版本补全后发布",
      },
    };
  const factor = parsed.data;
  const problem = factorApplicabilityProblem(factor, expected);
  return { factor: problem ? null : factor, problem };
}
