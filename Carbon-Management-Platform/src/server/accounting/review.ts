import "server-only";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { requireAccountingPermission } from "./context";
import { z } from "zod";
import { accountingInputsSchema } from "@/shared/accounting";
import { inputHash } from "./snapshot";

const submissionSnapshotSchema = z.object({
  ruleVersion: z.object({ id: z.uuid() }),
  inputs: accountingInputsSchema,
  assets: z.array(z.object({ id: z.uuid(), contentHash: z.string() })),
});

export async function submitRevision(
  principal: Principal,
  context: SchoolContext,
  caseId: string,
  runId: string,
  expectedInputRevision: number,
) {
  requireAccountingPermission(context.role, "accounting.write");
  return db.$transaction(async (tx) => {
    const entry = await tx.accountingCase.findFirst({
      where: { id: caseId, schoolId: context.schoolId },
    });
    if (!entry?.currentRevisionId)
      throw new RequestError("核算案例不存在", 404);
    const revision = await tx.accountingRevision.findFirst({
      where: {
        id: entry.currentRevisionId,
        schoolId: context.schoolId,
        status: "DRAFT",
        inputRevision: expectedInputRevision,
      },
    });
    if (!revision) throw new RequestError("修订已变化，请刷新后重试", 409);
    const run = await tx.calculationRun.findFirst({
      where: {
        id: runId,
        schoolId: context.schoolId,
        revisionId: revision.id,
        inputRevision: expectedInputRevision,
        mode: "PRODUCTION",
      },
    });
    if (!run) throw new RequestError("须先对当前输入完成正式计算", 409);
    const snapshot = submissionSnapshotSchema.safeParse(run.snapshots);
    if (
      !snapshot.success ||
      snapshot.data.ruleVersion.id !== revision.ruleVersionId ||
      inputHash(snapshot.data.inputs) !== inputHash(revision.inputs)
    )
      throw new RequestError("运行快照与当前输入或规则不一致，请重新计算", 409);
    const factorIds = [
      ...new Set(
        snapshot.data.inputs.lines
          .filter((line) => line.state === "RECORDED")
          .map((line) => line.factorVersionId),
      ),
    ].filter((id): id is string => !!id);
    // An interactive transaction uses one connection; run these reads in order.
    const rule = await tx.publicDataVersion.findFirst({
      where: {
        id: revision.ruleVersionId!,
        type: "RULE_CONFIG",
        status: "PUBLISHED",
      },
    });
    const count = await tx.publicDataVersion.count({
      where: {
        id: { in: factorIds },
        type: "EMISSION_FACTOR",
        status: "PUBLISHED",
        retiredAt: null,
      },
    });
    const assets = await tx.fileAsset.findMany({
      where: {
        schoolId: context.schoolId,
        id: { in: snapshot.data.assets.map((asset) => asset.id) },
      },
      select: { id: true, contentHash: true },
    });
    if (!rule || count !== factorIds.length)
      throw new RequestError("规则或因子已不可用，请重新计算", 409);
    const assetHashes = new Map(
      assets.map((asset) => [asset.id, asset.contentHash]),
    );
    if (
      snapshot.data.assets.some(
        (asset) => assetHashes.get(asset.id) !== asset.contentHash,
      )
    )
      throw new RequestError("证据附件已变化，请重新计算", 409);
    const changed = await tx.accountingRevision.updateMany({
      where: {
        id: revision.id,
        status: "DRAFT",
        inputRevision: expectedInputRevision,
      },
      data: {
        status: "SUBMITTED",
        submittedRunId: run.id,
        submittedById: principal.userId,
        submittedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw new RequestError("修订已被提交", 409);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "accounting.submit",
      targetType: "AccountingRevision",
      targetId: revision.id,
      details: { runId },
    });
    return tx.accountingRevision.findUniqueOrThrow({
      where: { id: revision.id },
    });
  });
}

export async function reviewRevision(
  principal: Principal,
  context: SchoolContext,
  caseId: string,
  decision: "APPROVE" | "REJECT",
  reason: string,
) {
  requireAccountingPermission(context.role, "accounting.review");
  if (decision === "REJECT" && !reason.trim())
    throw new RequestError("驳回须填写原因", 400);
  return db.$transaction(async (tx) => {
    const entry = await tx.accountingCase.findFirst({
      where: { id: caseId, schoolId: context.schoolId },
    });
    if (!entry?.currentRevisionId)
      throw new RequestError("核算案例不存在", 404);
    const revision = await tx.accountingRevision.findFirst({
      where: {
        id: entry.currentRevisionId,
        schoolId: context.schoolId,
        status: "SUBMITTED",
      },
    });
    if (!revision?.submittedRunId)
      throw new RequestError("没有待审核修订", 409);
    if (
      [
        revision.createdById,
        revision.lastEditedById,
        revision.submittedById,
      ].includes(principal.userId)
    )
      throw new RequestError("创建人、最后编辑人或提交人不可自审", 403);
    const updated = await tx.accountingRevision.updateMany({
      where: {
        id: revision.id,
        status: "SUBMITTED",
        submittedRunId: revision.submittedRunId,
      },
      data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED" },
    });
    if (updated.count !== 1) throw new RequestError("修订已被审核", 409);
    const review = await tx.accountingReview.create({
      data: {
        revisionId: revision.id,
        runId: revision.submittedRunId,
        actorId: principal.userId,
        decision,
        reason: reason.trim(),
      },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action:
        decision === "APPROVE" ? "accounting.approve" : "accounting.reject",
      targetType: "AccountingRevision",
      targetId: revision.id,
      details: { runId: revision.submittedRunId, reason: reason.trim() },
    });
    return review;
  });
}
