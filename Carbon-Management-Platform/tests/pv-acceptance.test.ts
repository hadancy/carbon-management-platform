import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pvAcceptanceSchema } from "../src/domain/acceptance/pv-contract";
import {
  acceptanceScopeHash,
  verifyPvAcceptance,
} from "../src/domain/acceptance/pv";

const fixturePath = join(
  process.cwd(),
  "tests/fixtures/pv-acceptance-reference.json",
);
const fixture = () =>
  pvAcceptanceSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
const evidence = () => new Set(fixture().evidence.map((item) => item.id));

test("T06: public-factor reference matches 27 independent raw and display expectations", () => {
  const report = verifyPvAcceptance(fixture(), evidence());
  assert.equal(report.numericalPassed, true);
  assert.equal(report.comparisons.length, 27);
  assert.equal(report.result?.display.footprintKgPerKwh, "0.038831");
  assert.equal(report.status, "PENDING_BUSINESS");
});

test("T06: a wrong raw value or rounded display fails independently", () => {
  const raw = fixture();
  raw.expected.lines[0].emissionsKg = "1471";
  assert.equal(verifyPvAcceptance(raw, evidence()).status, "FAILED");
  const display = fixture();
  display.expected.display.footprintKgPerKwh = "0.038830";
  assert.equal(verifyPvAcceptance(display, evidence()).numericalPassed, false);
});

test("T06: missing/duplicate line expectations and oversized tolerances are refused", () => {
  const missing = fixture();
  missing.expected.lines.pop();
  assert.equal(verifyPvAcceptance(missing, evidence()).numericalPassed, false);
  const duplicate = fixture();
  duplicate.expected.lines[1] = duplicate.expected.lines[0];
  assert.equal(
    verifyPvAcceptance(duplicate, evidence()).numericalPassed,
    false,
  );
  const tolerance = fixture();
  tolerance.expected.absoluteTolerance = "1";
  assert.equal(verifyPvAcceptance(tolerance).status, "INVALID");
});

// In-memory declarations exercise the completeness gate only; these names and
// IDs are fabricated test values and do not represent actual business approval.
function declaredBusinessFixture() {
  const bundle = fixture();
  bundle.caseKind = "BUSINESS";
  bundle.snapshot.mode = "PRODUCTION";
  bundle.snapshot.ruleVersion.content.purpose = "PRODUCTION";
  for (const factor of bundle.snapshot.factors)
    factor.content.purpose = "PRODUCTION";
  const assetId = "00000000-0000-4000-8000-000000000999";
  bundle.snapshot.assets = [
    {
      id: assetId,
      contentHash: bundle.evidence[0].sha256,
      name: "TEST evidence",
      mediaType: "application/pdf",
      size: 1,
    },
  ];
  for (const line of bundle.snapshot.inputs.lines)
    line.evidenceAssetIds = [assetId];
  for (const annual of bundle.snapshot.inputs.annualEnergy)
    annual.evidenceAssetIds = [assetId];
  const calculated = verifyPvAcceptance(bundle, evidence());
  assert.ok(calculated.result);
  bundle.run = {
    id: "00000000-0000-4000-8000-000000000998",
    schoolId: bundle.schoolId,
    engineVersion: "pv-grid-1.0.0",
    snapshots: structuredClone(bundle.snapshot),
    result: calculated.result,
  };
  const scopeHash = acceptanceScopeHash(bundle);
  bundle.decisions = bundle.decisions.map((item) => ({
    ...item,
    status: "CONFIRMED",
    conclusion: "TEST only",
    confirmedBy: "TEST business owner",
    confirmedAt: "2026-10-07",
    evidenceIds: ["INDEPENDENT_EXPECTED"],
    scopeHash,
  }));
  bundle.signoff = {
    preparedBy: "TEST preparer",
    reviewedBy: "TEST reviewer",
    acceptedBy: "TEST owner",
    acceptedAt: "2026-10-07",
    evidenceId: "INDEPENDENT_EXPECTED",
    scopeHash,
  };
  bundle.workflow = bundle.workflow.map((item) => ({
    ...item,
    status: "PASS",
    evidenceId: "INDEPENDENT_EXPECTED",
    scopeHash,
  }));
  return bundle;
}

test("T06: complete declared evidence is review-ready, while omitted B decisions remain pending", () => {
  const bundle = declaredBusinessFixture();
  assert.equal(
    verifyPvAcceptance(bundle, evidence()).status,
    "READY_FOR_REVIEW",
  );
  bundle.decisions = [];
  assert.equal(
    verifyPvAcceptance(bundle, evidence()).status,
    "PENDING_BUSINESS",
  );
});

test("T06: changed inputs invalidate saved snapshots and bound confirmations", () => {
  const bundle = declaredBusinessFixture();
  bundle.snapshot.inputs.lines[0].location = "changed location";
  const report = verifyPvAcceptance(bundle, evidence());
  assert.equal(report.numericalPassed, false);
  assert.ok(report.blockers.some((item) => item.includes("快照")));
  assert.ok(report.blockers.some((item) => item.startsWith("B01")));
});

test("T06: supplementary signed documents do not create a circular scope digest", () => {
  const bundle = declaredBusinessFixture();
  const originalHash = acceptanceScopeHash(bundle);
  bundle.evidence.push({
    id: "SIGNOFF",
    path: "TEST-signoff.pdf",
    sha256: "a".repeat(64),
  });
  bundle.signoff.evidenceId = "SIGNOFF";
  const verified = evidence();
  verified.add("SIGNOFF");
  assert.equal(acceptanceScopeHash(bundle), originalHash);
  assert.equal(verifyPvAcceptance(bundle, verified).status, "READY_FOR_REVIEW");
});

test("T06: incomplete production metadata remains pending even when numbers match", () => {
  const bundle = declaredBusinessFixture();
  bundle.snapshot.inputs.collectionStart = "invalid date";
  bundle.snapshot.inputs.lines[0].estimationMethod = "";
  bundle.run!.snapshots = structuredClone(bundle.snapshot);
  const scopeHash = acceptanceScopeHash(bundle);
  for (const item of bundle.decisions) item.scopeHash = scopeHash;
  for (const item of bundle.workflow) item.scopeHash = scopeHash;
  bundle.signoff.scopeHash = scopeHash;
  const report = verifyPvAcceptance(bundle, evidence());
  assert.equal(report.numericalPassed, true);
  assert.equal(report.status, "PENDING_BUSINESS");
  assert.ok(report.blockers.some((item) => item.includes("采集期间")));
  assert.ok(report.blockers.some((item) => item.includes("估算依据")));
});

test("T06: missing evidence, self review, foreign runs and changed results cannot pass", () => {
  const bundle = declaredBusinessFixture();
  assert.equal(verifyPvAcceptance(bundle).status, "PENDING_BUSINESS");
  bundle.signoff.reviewedBy = bundle.signoff.preparedBy;
  assert.equal(
    verifyPvAcceptance(bundle, evidence()).status,
    "PENDING_BUSINESS",
  );
  const foreign = declaredBusinessFixture();
  foreign.run!.schoolId = "00000000-0000-4000-8000-000000000997";
  assert.equal(verifyPvAcceptance(foreign, evidence()).status, "FAILED");
  const changed = declaredBusinessFixture();
  changed.run!.result = {};
  assert.equal(verifyPvAcceptance(changed, evidence()).status, "FAILED");
});

test("T06 CLI: reference evidence verifies, formal mode refuses it, and tampered files fail", () => {
  const command = (args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/verify-pv-acceptance.ts", ...args],
      { encoding: "utf8" },
    );
  assert.equal(command([]).status, 0);
  assert.equal(command(["--require-business"]).status, 1);
  const folder = mkdtempSync(join(tmpdir(), "carbon-t06-"));
  try {
    const bundle = fixture();
    bundle.evidence[0].path = "tampered.md";
    writeFileSync(join(folder, "tampered.md"), "changed evidence");
    writeFileSync(join(folder, "case.json"), JSON.stringify(bundle));
    const report = command([join(folder, "case.json")]);
    assert.equal(report.status, 1);
    assert.ok(
      JSON.parse(report.stdout).evidenceErrors.some((item: string) =>
        item.includes("摘要不符"),
      ),
    );
    assert.equal(command([fixturePath, "--output", fixturePath]).status, 1);
    const existingOutput = join(folder, "existing-result.json");
    writeFileSync(existingOutput, "must remain unchanged");
    assert.equal(command([fixturePath, "--output", existingOutput]).status, 1);
    assert.equal(readFileSync(existingOutput, "utf8"), "must remain unchanged");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
