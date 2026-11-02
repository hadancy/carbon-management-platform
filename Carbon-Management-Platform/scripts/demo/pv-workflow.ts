import assert from "node:assert/strict";
import { db } from "../../src/server/db/prisma";
import {
  createCase,
  createRevision,
  getCase,
  saveCaseInputs,
} from "../../src/server/accounting/cases";
import { runCalculation } from "../../src/server/accounting/runs";
import {
  reviewRevision,
  submitRevision,
} from "../../src/server/accounting/review";
import { getAsset } from "../../src/server/files/service";
import { RequestError } from "../../src/server/http/response";
import {
  verifyPvAcceptance,
  acceptanceHash,
} from "../../src/domain/acceptance/pv";
import type { PvAcceptanceBundle } from "../../src/domain/acceptance/pv-contract";
import type { setupPvDemo } from "./pv-setup";

type Demo = Awaited<ReturnType<typeof setupPvDemo>>;

async function rejectsStatus(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof RequestError && error.status === status,
  );
}

export async function runPvDemo(demo: Demo, code: string) {
  const { writer, reviewer, outsider, inputs, ruleVersionId } = demo;
  let entry = await db.accountingCase.findUnique({
    where: { schoolId_code: { schoolId: demo.schoolA.id, code } },
  });
  const reused = !!entry;
  if (!entry) {
    entry = await createCase(writer.principal, writer.context, {
      code,
      product: "DEMO 并网光伏流程验收（构造案例）",
      modelVersionId: demo.modelVersionId,
    });
    await saveCaseInputs(
      writer.principal,
      writer.context,
      entry.id,
      1,
      inputs,
      ruleVersionId,
    );
    const baseline = await runCalculation(
      writer.principal,
      writer.context,
      entry.id,
      "DEMO-R1-BASE",
      "PRODUCTION",
    );
    assert.ok(baseline.run, JSON.stringify(baseline.diagnostics));
    const retry = await runCalculation(
      writer.principal,
      writer.context,
      entry.id,
      "DEMO-R1-BASE",
      "PRODUCTION",
    );
    assert.equal(retry.run?.id, baseline.run.id);
    const originalHash = acceptanceHash(baseline.run);
    const changed = {
      ...inputs,
      lines: inputs.lines.map((line, i) =>
        i === 0 ? { ...line, value: "2100" } : line,
      ),
    };
    await saveCaseInputs(
      writer.principal,
      writer.context,
      entry.id,
      2,
      changed,
      ruleVersionId,
    );
    await rejectsStatus(
      submitRevision(
        writer.principal,
        writer.context,
        entry.id,
        baseline.run.id,
        3,
      ),
      409,
    );
    await rejectsStatus(
      runCalculation(
        writer.principal,
        writer.context,
        entry.id,
        "DEMO-R1-BASE",
        "PRODUCTION",
      ),
      409,
    );
    const corrected = await runCalculation(
      writer.principal,
      writer.context,
      entry.id,
      "DEMO-R1-CORRECTED",
      "PRODUCTION",
    );
    assert.ok(corrected.run);
    await rejectsStatus(
      submitRevision(
        outsider.principal,
        outsider.context,
        entry.id,
        corrected.run.id,
        3,
      ),
      404,
    );
    await submitRevision(
      writer.principal,
      writer.context,
      entry.id,
      corrected.run.id,
      3,
    );
    await rejectsStatus(
      reviewRevision(
        writer.principal,
        writer.context,
        entry.id,
        "APPROVE",
        "DEMO 自审",
      ),
      403,
    );
    await reviewRevision(
      reviewer.principal,
      reviewer.context,
      entry.id,
      "REJECT",
      "DEMO：验证驳回及修订，水泥活动量改为 2200 kg",
    );
    await createRevision(writer.principal, writer.context, entry.id);
    const revised = {
      ...inputs,
      lines: inputs.lines.map((line, i) =>
        i === 0 ? { ...line, value: "2200" } : line,
      ),
    };
    await saveCaseInputs(
      writer.principal,
      writer.context,
      entry.id,
      1,
      revised,
      ruleVersionId,
    );
    const approved = await runCalculation(
      writer.principal,
      writer.context,
      entry.id,
      "DEMO-R2-APPROVED",
      "PRODUCTION",
    );
    assert.ok(approved.run);
    await submitRevision(
      writer.principal,
      writer.context,
      entry.id,
      approved.run.id,
      2,
    );
    await reviewRevision(
      reviewer.principal,
      reviewer.context,
      entry.id,
      "APPROVE",
      "DEMO：修订后的构造数据通过流程复核",
    );
    await createRevision(writer.principal, writer.context, entry.id);
    const draft = await runCalculation(
      writer.principal,
      writer.context,
      entry.id,
      "DEMO-R3-DRAFT",
      "PRODUCTION",
    );
    assert.ok(draft.run);
    assert.equal(
      acceptanceHash(
        await db.calculationRun.findUniqueOrThrow({
          where: { id: baseline.run.id },
        }),
      ),
      originalHash,
    );
  }
  const detail = await getCase(demo.schoolA.id, entry.id);
  const first = detail.revisions.find((revision) => revision.revisionNo === 1);
  const second = detail.revisions.find((revision) => revision.revisionNo === 2);
  assert.equal(
    first?.status,
    "REJECTED",
    "已有演示案例未完成，请使用新的 DEMO_ 编码复跑",
  );
  assert.equal(second?.status, "APPROVED");
  assert.equal(first.reviews[0]?.decision, "REJECT");
  assert.equal(second.reviews[0]?.decision, "APPROVE");
  assert.notEqual(first.reviews[0].actorId, first.createdById);
  assert.notEqual(second.reviews[0].actorId, second.submittedById);
  const baseline = await db.calculationRun.findUniqueOrThrow({
    where: {
      revisionId_requestId: { revisionId: first.id, requestId: "DEMO-R1-BASE" },
    },
  });
  const bundle = {
    ...demo.reference,
    caseId: code,
    caseKind: "SYNTHETIC",
    schoolId: demo.schoolA.id,
    snapshot: baseline.snapshots,
    run: {
      id: baseline.id,
      schoolId: baseline.schoolId,
      engineVersion: baseline.engineVersion,
      snapshots: baseline.snapshots,
      result: baseline.result,
    },
  };
  const numeric = verifyPvAcceptance(bundle);
  assert.equal(numeric.numericalPassed, true, JSON.stringify(numeric.blockers));
  const corrected = await db.calculationRun.findUniqueOrThrow({
    where: {
      revisionId_requestId: {
        revisionId: first.id,
        requestId: "DEMO-R1-CORRECTED",
      },
    },
  });
  const approved = await db.calculationRun.findUniqueOrThrow({
    where: { id: second.submittedRunId! },
  });
  // Independent arithmetic: 2100/1000*735+2218.9=3762.4;
  // 2200/1000*735+2218.9=3835.9; denominator=95000.
  assert.equal(
    (corrected.result as { totalEmissionsKg: string }).totalEmissionsKg,
    "3762.4",
  );
  assert.equal(
    (approved.result as { totalEmissionsKg: string }).totalEmissionsKg,
    "3835.9",
  );
  assert.equal(
    (approved.result as { display: { footprintKgPerKwh: string } }).display
      .footprintKgPerKwh,
    "0.040378",
  );
  await rejectsStatus(getCase(demo.schoolB.id, entry.id), 404);
  await rejectsStatus(getAsset(demo.schoolB.id, demo.asset.id), 404);
  const downloaded = await getAsset(demo.schoolA.id, demo.asset.id);
  assert.equal(downloaded.contentHash, demo.asset.contentHash);
  assert.equal(downloaded.content.length, demo.asset.size);
  const current = detail.revisions.find(
    (revision) => revision.id === detail.currentRevisionId,
  )!;
  const snapshot =
    baseline.snapshots as unknown as PvAcceptanceBundle["snapshot"];
  assert.ok(
    snapshot.assets.some(
      (asset) =>
        asset.id === demo.asset.id &&
        asset.contentHash === downloaded.contentHash,
    ),
  );
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    acceptanceScope: "DEMO_WORKFLOW",
    status: "PASSED",
    execution: reused ? "REUSED_HISTORY" : "CREATED_AND_VERIFIED",
    caseId: entry.id,
    caseCode: code,
    schoolId: demo.schoolA.id,
    schoolName: demo.schoolA.name,
    casePath: `/accounting/${entry.id}`,
    currentRevision: { number: current.revisionNo, status: current.status },
    accounts: demoAccountsForReport(demo),
    checks: [
      "案例录入及附件关联",
      "27 项独立数值预期",
      "幂等运行",
      "输入变更后须重算",
      "提交及禁止自审",
      "独立复核驳回",
      "修订后审核通过",
      "历史运行及快照保留",
      "跨校案例与附件隔离",
      "同校证据下载",
    ],
    comparisons: numeric.comparisons,
    revisions: detail.revisions.map((revision) => ({
      number: revision.revisionNo,
      status: revision.status,
      inputRevision: revision.inputRevision,
      reviews: revision.reviews.map((review) => ({
        decision: review.decision,
        reason: review.reason,
      })),
      runs: revision.runs.map((run) => ({
        id: run.id,
        mode: run.mode,
        inputHash: run.inputHash,
        result: run.result,
      })),
    })),
    baselineHash: acceptanceHash(baseline),
    note: "用户指定的构造案例流程验收；演示账号复核记录用于测试状态流转。PRODUCTION 为既有计算/提交接口分支名。",
  };
}

function demoAccountsForReport(demo: Demo) {
  return {
    writer: demo.writer.principal.email,
    reviewer: demo.reviewer.principal.email,
    outsider: demo.outsider.principal.email,
  };
}
