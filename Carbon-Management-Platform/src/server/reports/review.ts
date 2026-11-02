import "server-only";
import { db } from "@/server/db/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import {
  reportContentSchema,
  reportContentIssues,
  reportRevisionRequestSchema,
  reviewReportSchema,
} from "@/shared/reports";
import { parseReportSource } from "@/domain/reports/snapshot";
import { requireReportPermission, reportContentHash } from "./context";
import type { z } from "zod";

export async function transitionReport(
  principal: Principal,
  context: SchoolContext,
  reportId: string,
  action: "submit" | "review",
  raw:
    | z.infer<typeof reportRevisionRequestSchema>
    | z.infer<typeof reviewReportSchema>,
) {
  requireReportPermission(
    context.role,
    action === "submit" ? "report.write" : "report.review",
  );
  const input =
    action === "review"
      ? reviewReportSchema.parse(raw)
      : reportRevisionRequestSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const report = await tx.footprintReport.findFirst({
      where: { id: reportId, schoolId: context.schoolId },
    });
    if (!report) throw new RequestError("报告不存在", 404);
    if (report.currentRevisionId !== input.revisionId)
      throw new RequestError("当前修订已变化，请刷新", 409);
    const status = action === "submit" ? "DRAFT" : "SUBMITTED";
    const revision = await tx.reportRevision.findFirst({
      where: {
        id: input.revisionId,
        reportId,
        schoolId: context.schoolId,
        status,
        contentRevision: input.expectedContentRevision,
      },
    });
    if (!revision)
      throw new RequestError("报告内容或状态已变化，请刷新后重试", 409);
    const content = reportContentSchema.parse(revision.contentSnapshot);
    const issues = reportContentIssues(content);
    if (issues.length) throw new RequestError(issues.join("；"), 400);
    const source = parseReportSource(report.sourceSnapshot);
    const hash = reportContentHash(
      reportId,
      revision.revisionNo,
      report.templateVersion,
      source,
      content,
      report.templateSnapshot,
    );
    const review = action === "review" ? reviewReportSchema.parse(input) : null;
    if (review) {
      if (
        [
          revision.createdById,
          revision.lastEditedById,
          revision.submittedById,
        ].includes(principal.userId)
      )
        throw new RequestError("创建人、最后编辑人或提交人不可自审", 403);
      if (revision.contentHash !== hash)
        throw new RequestError("冻结摘要不一致，不能审核", 409);
    }
    const result = await tx.reportRevision.updateMany({
      where: {
        id: revision.id,
        schoolId: context.schoolId,
        status,
        contentRevision: input.expectedContentRevision,
      },
      data: review
        ? {
            status: review.decision === "APPROVE" ? "APPROVED" : "REJECTED",
            reviewedById: principal.userId,
            reviewerName: principal.displayName,
            reviewReason: review.reason,
            reviewedAt: new Date(),
          }
        : {
            status: "SUBMITTED",
            submittedById: principal.userId,
            submittedAt: new Date(),
            contentHash: hash,
          },
    });
    if (result.count !== 1)
      throw new RequestError("报告已被其他人操作，请刷新", 409);
    await tx.footprintReport.update({
      where: { id: reportId },
      data: { updatedAt: new Date() },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: review
        ? review.decision === "APPROVE"
          ? "report.approve"
          : "report.reject"
        : "report.submit",
      targetType: "ReportRevision",
      targetId: revision.id,
      details: { contentHash: hash, reason: review?.reason ?? "" },
    });
    return tx.reportRevision.findUniqueOrThrow({ where: { id: revision.id } });
  });
}
