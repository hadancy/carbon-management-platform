import { z } from "zod";
import { isKnownUnit, isNumericFactor } from "./units";

export const emissionFactorDraftSchema = z.looseObject({
  value: z.string().trim().max(80),
  activityUnit: z
    .string()
    .refine((unit) => !unit || isKnownUnit(unit), "请选择列表中的活动数据单位"),
  emissionUnit: z.literal("kgCO2e"),
  note: z.string().trim().max(2000).default(""),
});

export const publishedEmissionFactorSchema = emissionFactorDraftSchema.refine(
  (factor) => isNumericFactor(factor.value) && isKnownUnit(factor.activityUnit),
  "发布排放因子前须填写数值并选择活动数据单位",
);

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.iso.date();

// V1 remains readable for existing published data. Only v2 can be selected by
// the calculation engine; publishing a new version must pass this schema.
export const calculationFactorSchema = z
  .object({
    schemaVersion: z.literal(2),
    purpose: z.enum(["TEST", "PRODUCTION"]),
    value: z
      .string()
      .refine((value) => /^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/.test(value)),
    activityUnit: z.string().refine(isKnownUnit),
    emissionUnit: z.literal("kgCO2e"),
    note: z.string().max(2000).default(""),
    applicability: z.object({
      product: z.literal("PV"),
      stage: z.enum(["RS", "TR", "CS", "US", "TD"]),
      subject: requiredText(200),
      region: requiredText(120),
      technology: requiredText(120),
      validFrom: isoDate,
      validTo: isoDate,
      dataYear: z.number().int().min(1900).max(2200),
      boundary: requiredText(500),
    }),
    evidence: z.object({
      sourceCategory: z.enum([
        "SUPPLIER",
        "GOVERNMENT",
        "INDUSTRY",
        "DATABASE",
        "LITERATURE",
        "STANDARD_APPENDIX",
        "OTHER",
      ]),
      issuer: requiredText(200),
      reference: requiredText(500),
      publishedAt: isoDate,
      originalValue: requiredText(120),
      conversion: requiredText(1000),
      license: requiredText(500),
    }),
    governance: z.object({
      basis: requiredText(500),
      changeReason: requiredText(500),
      supersedesVersionId: z.uuid().nullable().default(null),
    }),
  })
  .superRefine((factor, ctx) => {
    if (factor.applicability.validFrom > factor.applicability.validTo)
      ctx.addIssue({
        code: "custom",
        path: ["applicability", "validTo"],
        message: "适用结束日期早于开始日期",
      });
    if (factor.applicability.stage === "TR" && factor.activityUnit !== "t_km")
      ctx.addIssue({
        code: "custom",
        path: ["activityUnit"],
        message: "运输因子的分母须为 t·km",
      });
    if (factor.applicability.stage === "TD" && factor.activityUnit !== "kWh")
      ctx.addIssue({
        code: "custom",
        path: ["activityUnit"],
        message: "输配电因子的分母须为 kWh",
      });
  });

export type CalculationFactor = z.infer<typeof calculationFactorSchema>;

export type FactorVersionSnapshot = {
  id: string;
  code: string;
  version: string;
  type: "EMISSION_FACTOR";
  status: "DRAFT" | "PUBLISHED";
  retiredAt?: string | null;
  content: unknown;
};

export function copyLegacyFactorToV2Draft(
  legacy: unknown,
  fields: Omit<
    CalculationFactor,
    "schemaVersion" | "value" | "activityUnit" | "emissionUnit" | "note"
  >,
): CalculationFactor | null {
  const old = publishedEmissionFactorSchema.safeParse(legacy);
  if (!old.success) return null;
  const next = calculationFactorSchema.safeParse({
    ...old.data,
    ...fields,
    schemaVersion: 2,
  });
  return next.success ? next.data : null;
}

export type EmissionFactorDraft = z.infer<typeof emissionFactorDraftSchema>;

export function parseEmissionFactorContent(
  content: string,
): EmissionFactorDraft | null {
  try {
    const parsed = emissionFactorDraftSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
