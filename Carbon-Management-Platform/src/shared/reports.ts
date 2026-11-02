import { z } from "zod";

export const REPORT_TEMPLATE_VERSION = "pv-report-1.0.2";
export const REPORT_TEMPLATE_VERSIONS = [
  "pv-report-1.0.0",
  "pv-report-1.0.1",
  REPORT_TEMPLATE_VERSION,
] as const;
export const REPORT_STATUS_LABELS = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
} as const;
export type ReportStatus = keyof typeof REPORT_STATUS_LABELS;

export const reportContentSchema = z.strictObject({
  title: z.string().trim().max(200),
  preparedBy: z.string().trim().max(120),
  reportingDate: z.union([z.literal(""), z.iso.date()]),
  purpose: z.string().trim().max(4000),
  methodology: z.string().trim().max(8000),
  dataQuality: z.string().trim().max(8000),
  conclusion: z.string().trim().max(4000),
  limitations: z.string().trim().max(4000),
});
export type ReportContent = z.infer<typeof reportContentSchema>;
export const REPORT_CONTENT_FIELDS: {
  name: keyof ReportContent;
  label: string;
  max: number;
}[] = [
  { name: "title", label: "报告标题", max: 200 },
  { name: "preparedBy", label: "编制人 / 编制机构", max: 120 },
  { name: "reportingDate", label: "报告日期", max: 10 },
  { name: "purpose", label: "报告目的", max: 4000 },
  { name: "methodology", label: "核算方法与说明", max: 8000 },
  { name: "dataQuality", label: "数据质量与来源说明", max: 8000 },
  { name: "conclusion", label: "结果分析与结论", max: 4000 },
  { name: "limitations", label: "限制与声明", max: 4000 },
];
export function reportContentIssues(content: ReportContent) {
  return REPORT_CONTENT_FIELDS.filter(
    (field) => !content[field.name].trim(),
  ).map((field) => field.label + "为必填项");
}
export const createReportSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  calculationRunId: z.uuid(),
  templateVersionId: z.uuid().optional(),
});
export const reportRevisionRequestSchema = z.strictObject({
  revisionId: z.uuid(),
  expectedContentRevision: z.number().int().positive(),
});
export const saveReportSchema = reportRevisionRequestSchema.extend({
  content: reportContentSchema,
});
export const reviewReportSchema = reportRevisionRequestSchema.extend({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(1, "须填写审核意见").max(2000),
});
