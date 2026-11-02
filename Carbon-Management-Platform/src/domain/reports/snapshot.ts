import { z } from "zod";
import { accountingInputsSchema } from "../../shared/accounting";
import { modelContentSchema } from "../../shared/models";
import { pvRuleSchema } from "../../shared/calculation-rule";
import { calculationFactorSchema } from "../../shared/emission-factors";

const stageValues = z.object({
  RS: z.string(),
  TR: z.string(),
  CS: z.string(),
  US: z.string(),
  TD: z.string(),
});
const stageFlags = z.object({
  RS: z.boolean(),
  TR: z.boolean(),
  CS: z.boolean(),
  US: z.boolean(),
  TD: z.boolean(),
});
const resultSchema = z.object({
  engineVersion: z.literal("pv-grid-1.0.0"),
  mode: z.literal("PRODUCTION"),
  stagesKg: stageValues,
  lines: z.array(
    z.object({
      itemId: z.uuid(),
      stage: z.enum(["RS", "TR", "CS", "US", "TD"]),
      factorVersionId: z.uuid().nullable(),
      normalizedActivity: z.string(),
      emissionsKg: z.string(),
      conversions: z.array(
        z.object({
          originalValue: z.string(),
          originalUnit: z.string(),
          targetUnit: z.string(),
          multiplier: z.string(),
          convertedValue: z.string(),
        }),
      ),
    }),
  ),
  totalEmissionsKg: z.string(),
  gridEnergyKwh: z.string(),
  deliveredEnergyKwh: z.string(),
  footprintKgPerKwh: z.string(),
  display: z.object({
    stagesKg: stageValues,
    stagesBelowDisplayPrecision: stageFlags,
    totalEmissionsKg: z.string(),
    totalBelowDisplayPrecision: z.boolean(),
    gridEnergyKwh: z.string(),
    energyBelowDisplayPrecision: z.boolean(),
    footprintKgPerKwh: z.string(),
    belowDisplayPrecision: z.boolean(),
  }),
});
export const reportRunSnapshotSchema = z.object({
  modelVersion: z.object({
    id: z.uuid(),
    code: z.string(),
    version: z.number().int(),
    content: modelContentSchema,
  }),
  factors: z.array(
    z.object({
      id: z.uuid(),
      code: z.string(),
      version: z.string(),
      content: calculationFactorSchema,
    }),
  ),
  inputs: accountingInputsSchema,
  ruleVersion: z.object({
    id: z.uuid(),
    code: z.string(),
    version: z.string(),
    content: pvRuleSchema,
  }),
  scenario: z.literal("GRID_ONLY"),
  mode: z.literal("PRODUCTION"),
  assets: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      contentHash: z.string(),
      mediaType: z.string(),
      size: z.number().int(),
    }),
  ),
});
export const reportSourceSchema = z.object({
  schemaVersion: z.literal(1),
  school: z.object({ id: z.uuid(), name: z.string() }),
  accountingCase: z.object({
    id: z.uuid(),
    code: z.string(),
    product: z.string(),
    revisionNo: z.number().int(),
  }),
  run: z.object({
    id: z.uuid(),
    inputRevision: z.number().int(),
    inputHash: z.string(),
    createdAt: z.iso.datetime(),
  }),
  accountingReview: z.object({
    actorName: z.string(),
    reason: z.string(),
    reviewedAt: z.iso.datetime(),
  }),
  snapshot: reportRunSnapshotSchema,
  result: resultSchema,
  demonstration: z.boolean(),
});
export type ReportSource = z.infer<typeof reportSourceSchema>;

export function parseReportSource(input: unknown): ReportSource {
  return reportSourceSchema.parse(input);
}

export function isDemonstrationSnapshot(
  code: string,
  snapshot: z.infer<typeof reportRunSnapshotSchema>,
) {
  const selected = new Set(
    snapshot.inputs.lines
      .filter((line) => line.state === "RECORDED")
      .map((line) => line.factorVersionId ?? line.itemId),
  );
  const actualReferences = {
    ...snapshot,
    factors: snapshot.factors.filter((factor) => selected.has(factor.id)),
  };
  return /DEMO|SYN|TEST|演示|构造/i.test(
    code + " " + JSON.stringify(actualReferences),
  );
}
