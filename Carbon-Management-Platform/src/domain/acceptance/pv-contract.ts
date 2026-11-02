import { z } from "zod";
import { accountingInputsSchema } from "@/shared/accounting";
import { modelContentSchema } from "@/shared/models";
import { calculationFactorSchema } from "@/shared/emission-factors";
import { pvRuleSchema } from "@/shared/calculation-rule";
import { Exact } from "@/domain/calculation/decimal";

const text = z.string().trim().min(1);
const decimal = z
  .string()
  .max(120)
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const stages = z.object({
  RS: decimal,
  TR: decimal,
  CS: decimal,
  US: decimal,
  TD: decimal,
});

export const acceptanceSnapshotSchema = z.object({
  modelVersion: z.object({
    id: z.uuid(),
    code: text,
    version: z.number().int().positive(),
    content: modelContentSchema,
  }),
  factors: z.array(
    z.object({
      id: z.uuid(),
      code: text,
      version: text,
      type: z.literal("EMISSION_FACTOR"),
      status: z.literal("PUBLISHED"),
      retiredAt: z.string().nullable().optional(),
      content: calculationFactorSchema,
    }),
  ),
  inputs: accountingInputsSchema,
  assets: z.array(
    z.object({
      id: z.uuid(),
      contentHash: hash,
      name: text,
      mediaType: text,
      size: z.number().int().positive(),
    }),
  ),
  ruleVersion: z.object({
    id: z.uuid(),
    code: text,
    version: text,
    content: pvRuleSchema,
  }),
  scenario: z.literal("GRID_ONLY"),
  mode: z.enum(["TRIAL", "PRODUCTION"]),
});

export const pvAcceptanceSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: text,
  caseKind: z.enum(["SYNTHETIC", "PUBLIC_REFERENCE", "BUSINESS"]),
  schoolId: z.uuid(),
  snapshot: acceptanceSnapshotSchema,
  expected: z.object({
    method: z.enum(["MANUAL", "EXTERNAL_TOOL"]),
    description: text,
    evidenceId: z.string(),
    absoluteTolerance: decimal.refine(
      (value) => new Exact(value).lte("0.000000000001"),
      "原始值绝对误差须不超过 1e-12",
    ),
    lines: z.array(
      z.object({
        itemId: z.uuid(),
        normalizedActivity: decimal,
        emissionsKg: decimal,
      }),
    ),
    stagesKg: stages,
    totalEmissionsKg: decimal,
    gridEnergyKwh: decimal,
    deliveredEnergyKwh: decimal,
    footprintKgPerKwh: decimal,
    display: z.object({
      stagesKg: stages,
      totalEmissionsKg: decimal,
      gridEnergyKwh: decimal,
      footprintKgPerKwh: decimal,
    }),
  }),
  evidence: z.array(z.object({ id: text, path: text, sha256: hash })),
  decisions: z.array(
    z.object({
      id: z.enum(["B01", "B02", "B03", "B04", "B05", "B06"]),
      status: z.enum(["PENDING", "CONFIRMED"]),
      conclusion: z.string(),
      confirmedBy: z.string(),
      confirmedAt: z.iso.date().nullable(),
      evidenceIds: z.array(text),
      scopeHash: z.string(),
    }),
  ),
  signoff: z.object({
    preparedBy: z.string(),
    reviewedBy: z.string(),
    acceptedBy: z.string(),
    acceptedAt: z.iso.date().nullable(),
    evidenceId: z.string(),
    scopeHash: z.string(),
  }),
  workflow: z.array(
    z.object({
      id: z.enum(["REVIEW_REVISION", "CROSS_SCHOOL", "HISTORY_FROZEN"]),
      status: z.enum(["PENDING", "PASS"]),
      evidenceId: z.string(),
      scopeHash: z.string(),
    }),
  ),
  run: z
    .object({
      id: z.uuid(),
      schoolId: z.uuid(),
      engineVersion: text,
      snapshots: acceptanceSnapshotSchema,
      result: z.unknown(),
    })
    .optional(),
});

export type PvAcceptanceBundle = z.infer<typeof pvAcceptanceSchema>;
