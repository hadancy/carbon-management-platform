import { REPORT_TEMPLATE_VERSION } from "@/shared/reports";
import { TEMPLATE_TEXT_FIELDS } from "@/shared/report-template";
import type { PublicDataForm } from "./types";
export function templateFieldsFromContent(
  content: string,
): Partial<PublicDataForm> {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(content);
  } catch {}
  const defaults = (
    raw.defaults && typeof raw.defaults === "object" ? raw.defaults : {}
  ) as Record<string, unknown>;
  return {
    templatePurpose: raw.purpose === "PRODUCTION" ? "PRODUCTION" : "TEST",
    templateTitleSuffix:
      typeof raw.titleSuffix === "string" ? raw.titleSuffix : "碳足迹报告",
    templatePreparedBy:
      typeof raw.preparedBy === "string" ? raw.preparedBy : "",
    templateApprovalReference:
      typeof raw.approvalReference === "string" ? raw.approvalReference : "",
    templateDefaults: Object.fromEntries(
      TEMPLATE_TEXT_FIELDS.map((field) => [
        field,
        typeof defaults[field] === "string" ? defaults[field] : "",
      ]),
    ),
  };
}
export function templateContentFromFields(values: PublicDataForm) {
  return {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    layoutVersion: REPORT_TEMPLATE_VERSION,
    purpose: values.templatePurpose ?? "TEST",
    titleSuffix: values.templateTitleSuffix ?? "碳足迹报告",
    preparedBy: values.templatePreparedBy ?? "",
    approvalReference: values.templateApprovalReference ?? "",
    defaults: Object.fromEntries(
      TEMPLATE_TEXT_FIELDS.map((field) => [
        field,
        values.templateDefaults?.[field] ?? "",
      ]),
    ),
  };
}
