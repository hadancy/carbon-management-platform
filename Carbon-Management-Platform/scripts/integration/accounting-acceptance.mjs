import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

export async function verifyPersistentPvDemo({ env, expectStatus, signIn }) {
  const seed = () => {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/seed-pv-demo.ts",
      ],
      {
        env: { ...env, NODE_ENV: "test", PV_DEMO_PASSWORD: "Demo-PV-2026!" },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const created = seed();
  assert.equal(created.status, "PASSED");
  assert.equal(created.execution, "CREATED_AND_VERIFIED");
  assert.equal(created.comparisons.length, 27);
  const repeated = seed();
  assert.equal(repeated.execution, "REUSED_HISTORY");
  assert.equal(repeated.caseId, created.caseId);
  assert.equal(repeated.baselineHash, created.baselineHash);
  const writerCookie = await signIn(created.accounts.writer, "Demo-PV-2026!");
  const reviewerCookie = await signIn(
    created.accounts.reviewer,
    "Demo-PV-2026!",
  );
  const outsiderCookie = await signIn(
    created.accounts.outsider,
    "Demo-PV-2026!",
  );
  const path = `/api/accounting/cases/${created.caseId}`;
  const detail = await expectStatus(path, 200, { cookie: writerCookie });
  assert.equal(detail.case.revisions.length, 3);
  await expectStatus(path, 200, { cookie: reviewerCookie });
  await expectStatus(path, 404, { cookie: outsiderCookie });
  await expectStatus(created.casePath, 200, { cookie: writerCookie });
  const approved = created.revisions.find(
    (revision) => revision.status === "APPROVED",
  );
  const run = await expectStatus(
    `/api/accounting/runs/${approved.runs[0].id}`,
    200,
    { cookie: writerCookie },
  );
  assert.equal(run.run.result.display.footprintKgPerKwh, "0.040378");
  console.log(
    "T06 demo passed: persistent three-revision workflow, independent numeric checks, demo logins, authenticated case page/API, cross-school isolation, repeat without rewriting history.",
  );
}

// Only called against stage3-smoke's disposable database. PRODUCTION exercises
// the API branch; all underlying values remain explicitly synthetic test data.
export async function runAccountingAcceptanceRegression({
  expectStatus,
  adminCookie,
  schoolCookie,
  reviewerCookie,
  schoolBCookie,
  accountingPath,
  productionInputs,
  production,
  ruleDraft,
  pvFactorIds,
}) {
  const original = await expectStatus(
    `/api/accounting/runs/${production.run.id}`,
    200,
    { cookie: schoolCookie },
  );
  await expectStatus(`/api/admin/public-data/${ruleDraft.entry.id}`, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      title: "should stay frozen",
      source: "TEST",
      content: ruleDraft.entry.content,
    },
  });
  const originalFactor = original.run.snapshots.factors.find(
    (item) => item.id === pvFactorIds[0],
  );
  await expectStatus(`/api/admin/public-data/${pvFactorIds[0]}`, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      title: "should stay frozen",
      source: "TEST",
      content: originalFactor.content,
    },
  });
  const nextRule = await expectStatus("/api/admin/public-data", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      type: "RULE_CONFIG",
      code: ruleDraft.entry.code,
      version: "2",
      title: "SYN rule v2 TEST",
      source: "SYN-PV-001 TEST",
      content: {
        ...ruleDraft.entry.content,
        approvalReference: "SYN-PV-001 v2 TEST ONLY",
      },
    },
  });
  await expectStatus(
    `/api/admin/public-data/${nextRule.entry.id}/publish`,
    200,
    { method: "POST", cookie: adminCookie },
  );
  const nextFactor = await expectStatus("/api/admin/public-data", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      type: "EMISSION_FACTOR",
      code: originalFactor.code,
      version: "2",
      title: "SYN RS v2 TEST",
      source: "SYN-PV-001 TEST",
      content: {
        ...originalFactor.content,
        value: "3",
        governance: {
          ...originalFactor.content.governance,
          changeReason: "TEST version change",
          supersedesVersionId: originalFactor.id,
        },
      },
    },
  });
  await expectStatus(
    `/api/admin/public-data/${nextFactor.entry.id}/publish`,
    200,
    { method: "POST", cookie: adminCookie },
  );
  const updatedInputs = {
    ...productionInputs,
    lines: productionInputs.lines.map((line, index) =>
      index === 0
        ? { ...line, value: "1000", factorVersionId: nextFactor.entry.id }
        : line,
    ),
  };
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      expectedInputRevision: 1,
      ruleVersionId: nextRule.entry.id,
      inputs: updatedInputs,
    },
  });
  const requestId = randomUUID();
  const run = await expectStatus(`${accountingPath}/runs`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId, mode: "PRODUCTION" },
  });
  // Independent arithmetic: 1000*3 + 20 + 500 + 1000 + 460 = 4980;
  // denominator remains 100000*(1-0.05)=95000.
  assert.equal(run.run.result.totalEmissionsKg, "4980");
  assert.equal(run.run.result.display.footprintKgPerKwh, "0.052421");
  assert.equal(run.run.snapshots.ruleVersion.id, nextRule.entry.id);
  const changedInputs = {
    ...updatedInputs,
    lines: updatedInputs.lines.map((line, index) =>
      index === 0 ? { ...line, value: "1100" } : line,
    ),
  };
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      expectedInputRevision: 2,
      ruleVersionId: nextRule.entry.id,
      inputs: changedInputs,
    },
  });
  await expectStatus(`${accountingPath}/submit`, 409, {
    method: "POST",
    cookie: schoolCookie,
    body: { runId: run.run.id, expectedInputRevision: 3 },
  });
  await expectStatus(`${accountingPath}/runs`, 409, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId, mode: "PRODUCTION" },
  });
  const rerun = await expectStatus(`${accountingPath}/runs`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId: randomUUID(), mode: "PRODUCTION" },
  });
  assert.equal(rerun.run.result.totalEmissionsKg, "5280");
  assert.equal(rerun.run.result.display.footprintKgPerKwh, "0.055579");
  await expectStatus(`${accountingPath}/submit`, 404, {
    method: "POST",
    cookie: schoolBCookie,
    body: { runId: rerun.run.id, expectedInputRevision: 3 },
  });
  await expectStatus(`${accountingPath}/submit`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { runId: rerun.run.id, expectedInputRevision: 3 },
  });
  await expectStatus(`${accountingPath}/review`, 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: { decision: "REJECT", reason: "SYN TEST reject and revise" },
  });
  const nextRevision = await expectStatus(`${accountingPath}/revisions`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: {},
  });
  assert.equal(nextRevision.revision.revisionNo, 3);
  await expectStatus(`/api/admin/public-data/${pvFactorIds[0]}/retire`, 200, {
    method: "POST",
    cookie: adminCookie,
    body: { reason: "SYN TEST old factor retirement" },
  });
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      expectedInputRevision: 1,
      ruleVersionId: ruleDraft.entry.id,
      inputs: productionInputs,
    },
  });
  await expectStatus(`${accountingPath}/runs`, 400, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId: randomUUID(), mode: "PRODUCTION" },
  });
  const retained = await expectStatus(
    `/api/accounting/runs/${production.run.id}`,
    200,
    { cookie: schoolCookie },
  );
  assert.deepEqual(retained.run, original.run);
  await expectStatus(`/api/accounting/runs/${production.run.id}`, 404, {
    cookie: schoolBCookie,
  });
  console.log(
    "T06 engineering regression passed: rule/factor publication frozen, new versions, input changes require rerun, rejection/revision, retired-factor rejection, historical snapshots unchanged, cross-school submission denied.",
  );
}
