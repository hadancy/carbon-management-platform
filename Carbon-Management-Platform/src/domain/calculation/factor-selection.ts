import {
  calculationFactorSchema,
  type CalculationFactor,
  type FactorVersionSnapshot,
} from "@/shared/emission-factors";
import type { PvStage } from "@/shared/calculation-profile";

export type FactorProblem = { code: string; message: string };

export function selectFactor(
  snapshot: FactorVersionSnapshot | undefined,
  expected: {
    stage: PvStage;
    unit: string;
    subject: string;
    region: string;
    technology: string;
    referenceDate: string;
    mode: "TRIAL" | "PRODUCTION";
  },
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
  const area = factor.applicability;
  if (expected.mode === "PRODUCTION" && factor.purpose !== "PRODUCTION")
    return {
      factor: null,
      problem: { code: "TEST_FACTOR", message: "测试因子不能用于正式计算" },
    };
  if (
    area.stage !== expected.stage ||
    factor.activityUnit !== expected.unit ||
    (area.subject !== "ALL" && area.subject !== expected.subject)
  )
    return {
      factor: null,
      problem: {
        code: "FACTOR_MISMATCH",
        message: "因子的阶段、对象或分母单位不匹配",
      },
    };
  if (
    (area.region !== "ALL" && area.region !== expected.region) ||
    (area.technology !== "ALL" && area.technology !== expected.technology)
  )
    return {
      factor: null,
      problem: {
        code: "FACTOR_SCOPE",
        message: "因子地域或技术适用范围不匹配",
      },
    };
  if (
    expected.referenceDate < area.validFrom ||
    expected.referenceDate > area.validTo
  )
    return {
      factor: null,
      problem: { code: "FACTOR_EXPIRED", message: "因子不适用于核算日期" },
    };
  return { factor, problem: null };
}
