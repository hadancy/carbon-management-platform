import { z } from "zod";

export const pvRuleSchema = z
  .object({
    schemaVersion: z.literal(1),
    purpose: z.enum(["TEST", "PRODUCTION"]),
    product: z.literal("PV"),
    scenario: z.literal("GRID_ONLY"),
    formula: z.literal("PV_GRID_V1"),
    standardReference: z.string().trim().min(1).max(500),
    effectiveFrom: z.iso.date(),
    effectiveTo: z.iso.date(),
    approvalReference: z.string().trim().min(1).max(500),
  })
  .refine((rule) => rule.effectiveFrom <= rule.effectiveTo, {
    path: ["effectiveTo"],
    message: "规则结束日期早于开始日期",
  });
