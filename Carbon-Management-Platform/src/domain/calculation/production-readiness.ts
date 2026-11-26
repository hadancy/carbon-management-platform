import { z } from "zod";
import type { AccountingInputs } from "@/shared/accounting";
import type { PvRulePeriod } from "@/shared/calculation-rule";
import { sumAnnualEnergy } from "./energy";
import {
  factorApplicabilityProblem,
  type FactorDetails,
} from "./factor-selection";
import type { ModelRow } from "./model-rows";
import { diagnostic, type CalculationDiagnostic } from "./pv-contract";

const isoDate = z.iso.date();
const methodFields = [
  ["specification", "请填写产品规格"],
  ["projectLocation", "请填写项目地点"],
  ["boundaryNote", "请填写案例系统边界"],
] as const;
const activityFields = [
  ["location", "请填写发生地点"],
  ["process", "请填写设备或工艺"],
  ["measurementMethod", "请填写计量方法"],
  ["sourceType", "请选择实测或估算"],
] as const;

type ProductionContext = {
  rows: readonly ModelRow[];
  ruleVersionId?: string | null;
  rule?: PvRulePeriod | null;
  factors: ReadonlyMap<string, FactorDetails | null>;
  availableAssetIds?: ReadonlySet<string>;
};

export function productionReadiness(
  inputs: Partial<AccountingInputs>,
  { rows, ruleVersionId, rule, factors, availableAssetIds }: ProductionContext,
) {
  const requirements: CalculationDiagnostic[] = [];
  const problems: CalculationDiagnostic[] = [];
  const add = (path: string, code: string, message: string) =>
    requirements.push(diagnostic(path, "PRODUCTION", code, message, ""));

  for (const [field, message] of methodFields) {
    if (!inputs[field]?.trim()) add(field, "REQUIRED_METHOD_FIELD", message);
  }
  if (inputs.measurementUnit !== "kWh")
    add("measurementUnit", "INVALID_MEASUREMENT_UNIT", "正式计算须使用 kWh");
  if (inputs.exclusionNote?.trim() !== "无")
    add(
      "exclusionNote",
      "INVALID_EXCLUSIONS",
      "当前正式方法仅适用于无取舍项的案例",
    );
  const start = isoDate.safeParse(inputs.collectionStart);
  const end = isoDate.safeParse(inputs.collectionEnd);
  if (!start.success)
    add(
      "collectionStart",
      "INVALID_COLLECTION_START",
      "请选择有效的采集开始日期",
    );
  if (!end.success)
    add("collectionEnd", "INVALID_COLLECTION_END", "请选择有效的采集结束日期");
  else if (start.success && end.data < start.data)
    add(
      "collectionEnd",
      "INVALID_COLLECTION_ORDER",
      "采集结束日期须为开始日期当天或之后",
    );

  const referenceDate = isoDate.safeParse(inputs.referenceDate);
  if (!ruleVersionId)
    add(
      "ruleVersionId",
      "MISSING_PRODUCTION_RULE",
      "请选择已发布的正式规则版本",
    );
  else if (!rule || rule.purpose !== "PRODUCTION")
    add(
      "ruleVersionId",
      "INVALID_PRODUCTION_RULE",
      "请选择可用于正式计算的已发布规则",
    );
  else if (
    referenceDate.success &&
    (referenceDate.data < rule.effectiveFrom ||
      referenceDate.data > rule.effectiveTo)
  )
    add(
      "ruleVersionId",
      "RULE_OUTSIDE_PERIOD",
      `核算参考日期超出规则适用期（${rule.effectiveFrom} 至 ${rule.effectiveTo}）`,
    );

  function checkEvidence(
    path: string,
    ids: string[] | undefined,
    required: boolean,
  ) {
    if (required && !ids?.length)
      add(path, "MISSING_EVIDENCE_ASSETS", "请关联凭证附件");
    else if (availableAssetIds && ids?.some((id) => !availableAssetIds.has(id)))
      add(
        path,
        "UNAVAILABLE_EVIDENCE_ASSET",
        "请移除不可用的附件并关联本校凭证",
      );
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [index, line] of (inputs.lines ?? []).entries()) {
    const path = `lines.${index}`;
    const recorded = line.state === "RECORDED";
    const row = byId.get(line.itemId);
    const grid = row?.role === "GRID_FACTOR";
    const id = line.factorVersionId;
    if (id && !factors.has(id))
      add(
        `${path}.factorVersionId`,
        "UNAVAILABLE_PUBLIC_FACTOR",
        "所选公用因子不存在或已不可用，请重新选择",
      );
    else if (recorded && !id)
      add(
        `${path}.factorVersionId`,
        "MISSING_PUBLIC_FACTOR",
        "请选择已发布的正式公用因子",
      );
    else if (recorded && id && row) {
      const factor = factors.get(id);
      const problem = factor
        ? factorApplicabilityProblem(factor, {
            stage: row.stage,
            unit: row.unit,
            subject: row.name,
            region: inputs.region ?? "",
            technology: inputs.technology ?? "",
            referenceDate: grid ? inputs.referenceDate : line.activityDate,
            mode: "PRODUCTION",
          })
        : {
            code: "LEGACY_FACTOR",
            message: "因子缺少正式计算字段，请重新选择",
          };
      if (problem && problem.code !== "FACTOR_DATE_REQUIRED")
        problems.push(
          diagnostic(
            `${path}.factorVersionId`,
            "PV-05",
            problem.code,
            problem.message,
            "",
          ),
        );
    }

    checkEvidence(
      `${path}.evidenceAssetIds`,
      line.evidenceAssetIds,
      recorded && !grid,
    );
    if (recorded && !grid) {
      for (const [field, message] of activityFields) {
        if (!line[field]?.trim())
          add(`${path}.${field}`, "REQUIRED_ACTIVITY_FIELD", message);
      }
      if (line.sourceType === "ESTIMATED" && !line.estimationMethod?.trim())
        add(
          `${path}.estimationMethod`,
          "REQUIRED_ACTIVITY_FIELD",
          "请填写估算方法",
        );
    }
  }
  for (const [index, row] of (inputs.annualEnergy ?? []).entries())
    checkEvidence(
      `annualEnergy.${index}.evidenceAssetIds`,
      row.evidenceAssetIds,
      true,
    );
  const energy = sumAnnualEnergy(
    inputs.operatingYears ?? 1,
    inputs.annualEnergy ?? [],
  );
  for (const { path, code, message } of energy.problems)
    problems.push(diagnostic(path, "PV-10", code, message, ""));

  return { requirements, problems };
}

export function mergeCalculationDiagnostics(
  ...groups: CalculationDiagnostic[][]
): CalculationDiagnostic[] {
  const byIssue = new Map<string, CalculationDiagnostic>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.path}:${item.code}`;
      if (!byIssue.has(key)) byIssue.set(key, item);
    }
  }
  return [...byIssue.values()];
}
