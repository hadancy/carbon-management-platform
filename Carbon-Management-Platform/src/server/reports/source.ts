import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { RequestError } from "@/server/http/response";
import {
  reportSourceSchema,
  reportRunSnapshotSchema,
  isDemonstrationSnapshot,
} from "@/domain/reports/snapshot";

export async function approvedReportSource(
  tx: Prisma.TransactionClient,
  schoolId: string,
  runId: string,
) {
  const run = await tx.calculationRun.findFirst({
    where: {
      id: runId,
      schoolId,
      mode: "PRODUCTION",
      revision: { schoolId, status: "APPROVED" },
    },
    include: {
      school: { select: { id: true, name: true } },
      revision: { include: { case: true } },
      reviews: {
        where: { decision: "APPROVE" },
        include: { actor: { select: { displayName: true } } },
      },
    },
  });
  if (!run) throw new RequestError("只能从本校审核通过的正式运行创建报告", 404);
  const review = run.reviews.find(
    (entry) => entry.revisionId === run.revisionId,
  );
  if (!review || run.revision.submittedRunId !== run.id)
    throw new RequestError("该运行未获核算审核通过", 409);
  const snapshot = reportRunSnapshotSchema.parse(run.snapshots);
  return reportSourceSchema.parse({
    schemaVersion: 1,
    school: run.school,
    accountingCase: {
      id: run.revision.case.id,
      code: run.revision.case.code,
      product: run.revision.case.product,
      revisionNo: run.revision.revisionNo,
    },
    run: {
      id: run.id,
      inputRevision: run.inputRevision,
      inputHash: run.inputHash,
      createdAt: run.createdAt.toISOString(),
    },
    accountingReview: {
      actorName: review.actor.displayName,
      reason: review.reason,
      reviewedAt: review.createdAt.toISOString(),
    },
    snapshot,
    result: run.result,
    demonstration: isDemonstrationSnapshot(run.revision.case.code, snapshot),
  });
}
