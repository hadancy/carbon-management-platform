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
};
export type PublicDataForm = {
  type: Entry["type"];
  code: string;
  version: string;
  title: string;
  source?: string;
  contentText: string;
};
export const typeLabels: Record<Entry["type"], string> = {
  EMISSION_FACTOR: "公共排放因子",
  RULE_CONFIG: "标准与公式配置",
  REPORT_TEMPLATE: "通用报告模板",
};
