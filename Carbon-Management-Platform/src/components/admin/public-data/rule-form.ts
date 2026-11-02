import type { PublicDataForm } from "./types";

export function ruleFieldsFromContent(
  content: string,
): Partial<PublicDataForm> {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const text = (key: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : "";
  return {
    rulePurpose: raw.purpose === "PRODUCTION" ? "PRODUCTION" : "TEST",
    ruleStandardReference: text("standardReference"),
    ruleEffectiveFrom: text("effectiveFrom"),
    ruleEffectiveTo: text("effectiveTo"),
    ruleApprovalReference: text("approvalReference"),
  };
}

export function ruleContentFromFields(values: PublicDataForm) {
  return {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    formula: "PV_GRID_V1",
    purpose: values.rulePurpose ?? "TEST",
    standardReference: values.ruleStandardReference ?? "",
    effectiveFrom: values.ruleEffectiveFrom ?? "",
    effectiveTo: values.ruleEffectiveTo ?? "",
    approvalReference: values.ruleApprovalReference ?? "",
  };
}
