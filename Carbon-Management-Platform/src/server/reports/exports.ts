import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { requireReportPermission } from "./context";
import { getReportRevision } from "./queries";
import { revisionDocument } from "./rendering";
import { renderReportPdf } from "./pdf";

const jobs = new Map<string, Promise<Buffer>>();
export async function reportPdfFile(
  principal: Principal,
  context: SchoolContext,
  revisionId: string,
  generate: boolean,
) {
  requireReportPermission(context.role, "report.export");
  const revision = await getReportRevision(context.schoolId, revisionId);
  if (revision.status !== "APPROVED" || !revision.contentHash)
    throw new RequestError("仅已审核通过的报告修订可导出 PDF", 409);
  const document = revisionDocument(revision);
  let file = await db.reportExport.findFirst({
    where: { revisionId, schoolId: context.schoolId },
  });
  if (!file && !generate) throw new RequestError("请先生成该修订的 PDF", 409);
  if (!file) {
    const key = context.schoolId + ":" + revisionId;
    let rendering = jobs.get(key);
    if (!rendering) {
      rendering = renderReportPdf(document);
      jobs.set(key, rendering);
    }
    let content: Buffer;
    try {
      content = await rendering;
    } finally {
      if (jobs.get(key) === rendering) jobs.delete(key);
    }
    const fileHash = createHash("sha256").update(content).digest("hex");
    try {
      file = await db.$transaction(async (tx) => {
        const frozen = await tx.reportRevision.findFirst({
          where: {
            id: revisionId,
            schoolId: context.schoolId,
            status: "APPROVED",
            contentHash: revision.contentHash,
          },
        });
        if (!frozen) throw new RequestError("报告审核状态已变化", 409);
        const created = await tx.reportExport.create({
          data: {
            revisionId,
            schoolId: context.schoolId,
            contentHash: revision.contentHash!,
            fileHash,
            content: new Uint8Array(content),
            createdById: principal.userId,
          },
        });
        await audit(tx, {
          actorId: principal.userId,
          schoolId: context.schoolId,
          action: "report.export",
          targetType: "ReportExport",
          targetId: created.id,
          details: { revisionId, contentHash: created.contentHash, fileHash },
        });
        return created;
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ))
        throw error;
      file = await db.reportExport.findFirst({
        where: { revisionId, schoolId: context.schoolId },
      });
      if (!file) throw error;
    }
  }
  if (
    file.contentHash !== revision.contentHash ||
    createHash("sha256").update(file.content).digest("hex") !== file.fileHash
  )
    throw new RequestError("PDF 文件摘要不一致，请联系管理员", 409);
  await audit(db, {
    actorId: principal.userId,
    schoolId: context.schoolId,
    action: "report.download",
    targetType: "ReportExport",
    targetId: file.id,
    details: { revisionId, fileHash: file.fileHash },
  });
  return {
    file,
    name: revision.report.code + "-v" + revision.revisionNo + ".pdf",
  };
}
