import { emissionFactorDraftSchema } from "@/shared/emission-factors";
import type { PublicDataForm } from "./types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function factorFieldsFromContent(
  content: string,
): Partial<PublicDataForm> {
  let raw: Record<string, unknown>;
  try {
    raw = object(JSON.parse(content));
  } catch {
    return {};
  }
  const applicable = object(raw.applicability);
  const evidence = object(raw.evidence);
  const governance = object(raw.governance);
  return {
    factorValue: string(raw.value),
    factorActivityUnit: string(raw.activityUnit),
    factorNote: string(raw.note),
    factorPurpose: raw.purpose === "PRODUCTION" ? "PRODUCTION" : "TEST",
    factorStage: string(applicable.stage) as PublicDataForm["factorStage"],
    factorSubject: string(applicable.subject),
    factorRegion: string(applicable.region),
    factorTechnology: string(applicable.technology),
    factorValidFrom: string(applicable.validFrom),
    factorValidTo: string(applicable.validTo),
    factorDataYear:
      typeof applicable.dataYear === "number" ? applicable.dataYear : undefined,
    factorBoundary: string(applicable.boundary),
    factorSourceCategory: string(evidence.sourceCategory),
    factorIssuer: string(evidence.issuer),
    factorReference: string(evidence.reference),
    factorPublishedAt: string(evidence.publishedAt),
    factorOriginalValue: string(evidence.originalValue),
    factorConversion: string(evidence.conversion),
    factorLicense: string(evidence.license),
    factorBasis: string(governance.basis),
    factorChangeReason: string(governance.changeReason),
    factorSupersedesVersionId: string(governance.supersedesVersionId) || null,
  };
}

export function factorContentFromFields(
  values: PublicDataForm,
  legacyContent?: string | null,
) {
  const base = emissionFactorDraftSchema.safeParse({
    value: values.factorValue ?? "",
    activityUnit: values.factorActivityUnit ?? "",
    emissionUnit: "kgCO2e",
    note: values.factorNote ?? "",
  });
  if (!base.success)
    throw new Error(base.error.issues[0]?.message ?? "因子数值或单位无效");
  return {
    ...(legacyContent ? { legacyContent: JSON.parse(legacyContent) } : {}),
    ...base.data,
    schemaVersion: 2,
    purpose: values.factorPurpose ?? "TEST",
    applicability: {
      product: "PV",
      stage: values.factorStage ?? "",
      subject: values.factorSubject ?? "",
      region: values.factorRegion ?? "",
      technology: values.factorTechnology ?? "",
      validFrom: values.factorValidFrom ?? "",
      validTo: values.factorValidTo ?? "",
      dataYear: Number(values.factorDataYear) || 0,
      boundary: values.factorBoundary ?? "",
    },
    evidence: {
      sourceCategory: values.factorSourceCategory ?? "",
      issuer: values.factorIssuer ?? "",
      reference: values.factorReference ?? "",
      publishedAt: values.factorPublishedAt ?? "",
      originalValue: values.factorOriginalValue ?? "",
      conversion: values.factorConversion ?? "",
      license: values.factorLicense ?? "",
    },
    governance: {
      basis: values.factorBasis ?? "",
      changeReason: values.factorChangeReason ?? "",
      supersedesVersionId: values.factorSupersedesVersionId || null,
    },
  };
}
