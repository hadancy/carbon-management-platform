import { z } from "zod";

export const ACCOUNTING_STATUS_LABELS = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
} as const;
export const ACCOUNTING_STAGE_LABELS = {
  RS: "原材料及设备",
  TR: "运输",
  CS: "设施建设",
  US: "生产及退役",
  TD: "输配电",
} as const;
export type AccountingStatus = keyof typeof ACCOUNTING_STATUS_LABELS;

const shortText = z.string().trim().max(200);
const amount = z.string().trim().max(80);
const assetIds = z.array(z.uuid()).max(20).default([]);

export const accountingInputsSchema = z.object({
  specification: shortText.default(""),
  measurementUnit: shortText.default("kWh"),
  projectLocation: shortText.default(""),
  collectionStart: shortText.default(""),
  collectionEnd: shortText.default(""),
  boundaryNote: z.string().trim().max(2000).default(""),
  exclusionNote: z.string().trim().max(2000).default(""),
  referenceDate: shortText.default(""),
  region: shortText.default(""),
  technology: shortText.default(""),
  operatingYears: z.number().int().min(1).max(100).default(1),
  annualEnergy: z
    .array(
      z.object({
        operatingYear: z.number().int(),
        periodStart: shortText,
        periodEnd: shortText,
        source: z.enum(["ACTUAL", "ESTIMATED"]),
        value: amount,
        unit: shortText,
        evidence: shortText,
        evidenceAssetIds: assetIds,
        method: shortText.optional(),
      }),
    )
    .max(100)
    .default([]),
  directSupplyKwh: amount.default("0"),
  lossRatio: amount.default("0"),
  transmissionMethod: z
    .enum(["GRID_FACTOR_FALLBACK", "SF6_ACTUAL"])
    .default("GRID_FACTOR_FALLBACK"),
  transmissionFallbackReason: z.string().trim().max(2000).default(""),
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        state: z.enum(["RECORDED", "NOT_APPLICABLE"]),
        reason: shortText.optional(),
        factorVersionId: z.uuid().optional(),
        value: amount.optional(),
        unit: shortText.optional(),
        weight: amount.optional(),
        weightUnit: shortText.optional(),
        distance: amount.optional(),
        distanceUnit: shortText.optional(),
        evidence: shortText.optional(),
        evidenceAssetIds: assetIds,
        activityDate: shortText.optional(),
        location: shortText.optional(),
        process: shortText.optional(),
        measurementMethod: shortText.optional(),
        sourceType: z.enum(["ACTUAL", "ESTIMATED"]).optional(),
        estimationMethod: shortText.optional(),
      }),
    )
    .max(500)
    .default([]),
});

export type AccountingInputs = z.infer<typeof accountingInputsSchema>;

export const emptyAccountingInputs = (): AccountingInputs => ({
  specification: "",
  measurementUnit: "kWh",
  projectLocation: "",
  collectionStart: "",
  collectionEnd: "",
  boundaryNote: "",
  exclusionNote: "",
  referenceDate: "",
  region: "",
  technology: "",
  operatingYears: 1,
  annualEnergy: [],
  directSupplyKwh: "0",
  lossRatio: "0",
  transmissionMethod: "GRID_FACTOR_FALLBACK",
  transmissionFallbackReason: "",
  lines: [],
});

export const createCaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  product: z.string().trim().min(1).max(200),
  modelVersionId: z.uuid(),
});

export const saveInputsSchema = z.object({
  expectedInputRevision: z.number().int().positive(),
  ruleVersionId: z.uuid().nullable(),
  inputs: accountingInputsSchema,
});
