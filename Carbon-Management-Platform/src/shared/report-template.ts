import { z } from "zod";
import {
  REPORT_TEMPLATE_VERSION,
  reportContentSchema,
  type ReportContent,
} from "./reports";
export const TEMPLATE_TEXT_FIELDS = [
  "purpose",
  "methodology",
  "dataQuality",
  "conclusion",
  "limitations",
] as const;
export const publicReportTemplateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  product: z.literal("PV"),
  scenario: z.literal("GRID_ONLY"),
  layoutVersion: z.literal(REPORT_TEMPLATE_VERSION),
  purpose: z.enum(["TEST", "PRODUCTION"]),
  approvalReference: z.string().trim().min(1, "请填写模板确认依据").max(2000),
  titleSuffix: z.string().trim().min(1, "请填写标题后缀").max(80),
  preparedBy: reportContentSchema.shape.preparedBy,
  defaults: reportContentSchema.pick({
    purpose: true,
    methodology: true,
    dataQuality: true,
    conclusion: true,
    limitations: true,
  }),
});
export type PublicReportTemplate = z.infer<typeof publicReportTemplateSchema>;
export const publicTemplateSnapshotSchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  version: z.string(),
  title: z.string(),
  content: publicReportTemplateSchema,
});
export type PublicTemplateSnapshot = z.infer<
  typeof publicTemplateSnapshotSchema
>;
export function applyReportTemplate(
  base: ReportContent,
  product: string,
  template: PublicReportTemplate,
): ReportContent {
  const content = {
    ...base,
    title: (product + template.titleSuffix).slice(0, 200),
    preparedBy: template.preparedBy || base.preparedBy,
  };
  for (const field of TEMPLATE_TEXT_FIELDS)
    if (template.defaults[field]) content[field] = template.defaults[field];
  return reportContentSchema.parse(content);
}
