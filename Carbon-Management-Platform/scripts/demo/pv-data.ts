import { readFile } from "node:fs/promises";
import { pvAcceptanceSchema } from "../../src/domain/acceptance/pv-contract";
import { accountingInputsSchema } from "../../src/shared/accounting";

export const demoPassword = process.env.PV_DEMO_PASSWORD ?? "Demo-PV-2026!";
export const demoAccounts = {
  writer: { email: "pv-writer@demo.invalid", name: "光伏演示录入员" },
  reviewer: { email: "pv-reviewer@demo.invalid", name: "光伏演示复核员" },
  outsider: { email: "pv-outsider@demo.invalid", name: "光伏演示学校 B" },
};

export async function loadDemoReference() {
  return pvAcceptanceSchema.parse(
    JSON.parse(
      await readFile("tests/fixtures/pv-acceptance-reference.json", "utf8"),
    ),
  );
}

// A valid one-pixel PNG, explicitly named as a workflow placeholder. It tests
// upload/download and snapshot binding, and is never presented as site evidence.
export function demoEvidenceFile() {
  return new File(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    "DEMO-流程占位附件.png",
    { type: "image/png" },
  );
}

export function demoInputs(
  reference: Awaited<ReturnType<typeof loadDemoReference>>,
  factorIds: string[],
  assetId: string,
) {
  return accountingInputsSchema.parse({
    ...reference.snapshot.inputs,
    specification: "DEMO 并网光伏五阶段",
    projectLocation: "演示学校 A（构造地点）",
    boundaryNote: "DEMO：构造活动量、寿命、电量及线损，仅用于流程验收",
    annualEnergy: reference.snapshot.inputs.annualEnergy.map((row) => ({
      ...row,
      evidence: "DEMO 构造电量；附件仅验证上传和快照关联",
      evidenceAssetIds: [assetId],
    })),
    lines: reference.snapshot.inputs.lines.map((row, index) => ({
      ...row,
      factorVersionId: factorIds[index],
      evidence: "DEMO 构造活动量；附件仅验证上传和快照关联",
      evidenceAssetIds: [assetId],
    })),
  });
}
