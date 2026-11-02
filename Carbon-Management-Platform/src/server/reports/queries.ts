import "server-only";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";

export async function listReports(schoolId: string) {
  return db.footprintReport.findMany({
    where: { schoolId },
    include: { currentRevision: true },
    orderBy: { updatedAt: "desc" },
  });
}
export async function getReport(schoolId: string, id: string) {
  const report = await db.footprintReport.findFirst({
    where: { id, schoolId },
    include: {
      revisions: {
        orderBy: { revisionNo: "desc" },
        include: {
          export: { select: { id: true, fileHash: true, createdAt: true } },
        },
      },
    },
  });
  if (!report) throw new RequestError("报告不存在", 404);
  return report;
}
export async function getReportRevision(schoolId: string, id: string) {
  const revision = await db.reportRevision.findFirst({
    where: { id, schoolId },
    include: { report: true },
  });
  if (!revision || revision.report.schoolId !== schoolId)
    throw new RequestError("报告修订不存在", 404);
  return revision;
}
export async function listApprovedReportRuns(schoolId: string) {
  return db.calculationRun.findMany({
    where: {
      schoolId,
      mode: "PRODUCTION",
      revision: { schoolId, status: "APPROVED" },
      reviews: { some: { decision: "APPROVE" } },
    },
    include: { revision: { include: { case: true } } },
    orderBy: { createdAt: "desc" },
  });
}
