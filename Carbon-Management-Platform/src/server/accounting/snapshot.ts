import "server-only";
import { createHash } from "node:crypto";
import type { AccountingInputs } from "@/shared/accounting";
import type { ModelContent } from "@/shared/models";
import type { FactorVersionSnapshot } from "@/shared/emission-factors";
import type { PvCalculationInput } from "@/domain/calculation/pv";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import { modelContentSchema } from "@/shared/models";
import { calculationFactorSchema } from "@/shared/emission-factors";
import { isNumericFactor } from "@/shared/units";
import { parseNonnegative } from "@/domain/calculation/decimal";

const NUMERIC_KEYS = new Set([
  "value",
  "weight",
  "distance",
  "directSupplyKwh",
  "lossRatio",
  "emissionFactor",
]);
function canonical(value: unknown, key = ""): string {
  if (typeof value === "string" && NUMERIC_KEYS.has(key))
    return JSON.stringify(parseNonnegative(value)?.toString() ?? value);
  if (Array.isArray(value))
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v, k)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function inputHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function modelFactors(
  content: ModelContent,
  version: number,
  publishedAt: Date | null,
): FactorVersionSnapshot[] {
  const stageById = new Map(
    content.calculationProfile?.stageMappings.map((entry) => [
      entry.stageId,
      entry.calculationStage,
    ]) ?? [],
  );
  const factors: FactorVersionSnapshot[] = [];
  for (const stage of content.stages)
    for (const category of stage.categories)
      for (const item of category.items) {
        const stageCode = stageById.get(stage.id);
        const mapping = content.calculationProfile?.itemMappings.find(
          (entry) => entry.itemId === item.id,
        );
        if (!stageCode || !mapping || !isNumericFactor(item.emissionFactor))
          continue;
        const candidate = calculationFactorSchema.safeParse({
          schemaVersion: 2,
          purpose: "TEST",
          value: item.emissionFactor,
          activityUnit: mapping.factorActivityUnit,
          emissionUnit: "kgCO2e",
          note: "模型版本内填写的因子，仅供试算",
          applicability: {
            product: "PV",
            stage: stageCode,
            subject: item.dataName,
            region: "ALL",
            technology: "ALL",
            validFrom: "1900-01-01",
            validTo: "2200-12-31",
            dataYear: publishedAt?.getUTCFullYear() ?? 2000,
            boundary: content.boundary || "模型系统边界",
          },
          evidence: {
            sourceCategory: "OTHER",
            issuer: item.factorSource || "模型维护者",
            reference: item.factorSource || "模型内因子",
            publishedAt:
              publishedAt?.toISOString().slice(0, 10) ?? "2000-01-01",
            originalValue: item.emissionFactor,
            conversion: "未换算",
            license: "仅用于试算",
          },
          governance: {
            basis: "模型版本快照",
            changeReason: "模型版本内因子试算",
            supersedesVersionId: null,
          },
        });
        if (candidate.success)
          factors.push({
            id: item.id,
            code: `MODEL-${item.id}`,
            version: `${version}`,
            type: "EMISSION_FACTOR",
            status: "PUBLISHED",
            content: candidate.data,
          });
      }
  return factors;
}

export async function resolveSnapshot(
  schoolId: string,
  modelVersionId: string,
  inputs: AccountingInputs,
  mode: "TRIAL" | "PRODUCTION",
  scenario: "GRID_ONLY" | "DIRECT_ONLY" | "MIXED",
) {
  const version = await db.modelVersion.findFirst({
    where: {
      id: modelVersionId,
      status: "PUBLISHED",
      model: { scope: "SCHOOL", schoolId, archivedAt: null },
    },
    include: { model: true },
  });
  if (!version) throw new RequestError("仅可使用本校已发布模型版本", 400);
  const content = modelContentSchema.parse(version.content);
  const requestedIds = [
    ...new Set(
      inputs.lines
        .map((line) => line.factorVersionId)
        .filter((id): id is string => !!id),
    ),
  ];
  const publicVersions = await db.publicDataVersion.findMany({
    where: {
      id: { in: requestedIds },
      type: "EMISSION_FACTOR",
      status: "PUBLISHED",
      retiredAt: null,
    },
    orderBy: { id: "asc" },
  });
  if (mode === "TRIAL" && publicVersions.length !== requestedIds.length)
    throw new RequestError("所选公用因子不存在或不可用", 400);
  const publicFactors: FactorVersionSnapshot[] = publicVersions.map(
    (factor) => ({
      id: factor.id,
      code: factor.code,
      version: factor.version,
      type: "EMISSION_FACTOR",
      status: "PUBLISHED",
      retiredAt: factor.retiredAt?.toISOString() ?? null,
      content: factor.content,
    }),
  );
  const factors: FactorVersionSnapshot[] = [
    ...publicFactors,
    ...modelFactors(content, version.version, version.publishedAt),
  ];
  const lines = inputs.lines.map((line) => ({
    ...line,
    factorVersionId: line.factorVersionId ?? line.itemId,
  }));
  const calculation: PvCalculationInput = {
    mode,
    scenario,
    model: { id: version.id, scope: "SCHOOL", status: "PUBLISHED", content },
    factors,
    referenceDate: inputs.referenceDate,
    region: inputs.region,
    technology: inputs.technology,
    lines,
    operatingYears: inputs.operatingYears,
    annualEnergy: inputs.annualEnergy,
    directSupplyKwh: inputs.directSupplyKwh,
    lossRatio: inputs.lossRatio,
    transmissionMethod: inputs.transmissionMethod,
    transmissionFallbackReason: inputs.transmissionFallbackReason,
  };
  return {
    calculation,
    modelVersion: {
      id: version.id,
      version: version.version,
      code: version.model.code,
      content,
    },
    factors,
    publicFactors,
  };
}
