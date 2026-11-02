export type Entry = {
  id: string;
  type: "EMISSION_FACTOR" | "RULE_CONFIG" | "REPORT_TEMPLATE";
  code: string;
  version: string;
  title: string;
  source: string | null;
  status: "DRAFT" | "PUBLISHED";
  content: string;
  publishedAt: string | null;
  retiredAt: string | null;
};
export type PublicDataForm = {
  type: Entry["type"];
  code: string;
  version: string;
  title: string;
  source?: string;
  contentText: string;
  rulePurpose?: "TEST" | "PRODUCTION";
  ruleStandardReference?: string;
  ruleEffectiveFrom?: string;
  ruleEffectiveTo?: string;
  ruleApprovalReference?: string;
  templatePurpose?: "TEST" | "PRODUCTION";
  templateTitleSuffix?: string;
  templatePreparedBy?: string;
  templateApprovalReference?: string;
  templateDefaults?: Partial<
    Record<
      "purpose" | "methodology" | "dataQuality" | "conclusion" | "limitations",
      string
    >
  >;
  factorValue?: string;
  factorActivityUnit?: string;
  factorNote?: string;
  factorPurpose?: "TEST" | "PRODUCTION";
  factorStage?: "RS" | "TR" | "CS" | "US" | "TD";
  factorSubject?: string;
  factorRegion?: string;
  factorTechnology?: string;
  factorValidFrom?: string;
  factorValidTo?: string;
  factorDataYear?: number;
  factorBoundary?: string;
  factorSourceCategory?: string;
  factorIssuer?: string;
  factorReference?: string;
  factorPublishedAt?: string;
  factorOriginalValue?: string;
  factorConversion?: string;
  factorLicense?: string;
  factorBasis?: string;
  factorChangeReason?: string;
  factorSupersedesVersionId?: string | null;
};
export const typeLabels: Record<Entry["type"], string> = {
  EMISSION_FACTOR: "公共排放因子",
  RULE_CONFIG: "标准与公式配置",
  REPORT_TEMPLATE: "通用报告模板",
};
