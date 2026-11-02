import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import {
  REPORT_TEMPLATE_VERSION,
  reportContentSchema,
  type ReportContent,
} from "@/shared/reports";
import {
  publicReportTemplateSchema,
  applyReportTemplate,
  type PublicTemplateSnapshot,
} from "@/shared/report-template";
import { defaultReportContent } from "@/domain/reports/document";
import { approvedReportSource } from "./source";
import { requireReportPermission } from "./context";

type RevisionRequest = { revisionId: string; expectedContentRevision: number };
export async function createReport(
  principal: Principal,
  context: SchoolContext,
  input: { code: string; calculationRunId: string; templateVersionId?: string },
) {
  requireReportPermission(context.role, "report.write");
  return db.$transaction(async (tx) => {
    const source = await approvedReportSource(
      tx,
      context.schoolId,
      input.calculationRunId,
    );
    let template: PublicTemplateSnapshot | undefined;
    if (input.templateVersionId) {
      const version = await tx.publicDataVersion.findFirst({
        where: {
          id: input.templateVersionId,
          type: "REPORT_TEMPLATE",
          status: "PUBLISHED",
        },
      });
      if (!version) throw new RequestError("报告模板未发布或不存在", 400);
      const checked = publicReportTemplateSchema.safeParse(version.content);
      if (!checked.success)
        throw new RequestError("所选报告模板不可用于当前并网光伏报告", 400);
      template = {
        id: version.id,
        code: version.code,
        version: version.version,
        title: version.title,
        content: checked.data,
      };
    }
    const baseContent = defaultReportContent(source, principal.displayName);
    const content = template
      ? applyReportTemplate(
          baseContent,
          source.accountingCase.product,
          template.content,
        )
      : baseContent;
    const report = await tx.footprintReport.create({
      data: {
        schoolId: context.schoolId,
        code: input.code,
        calculationRunId: input.calculationRunId,
        templateVersion: REPORT_TEMPLATE_VERSION,
        sourceSnapshot: source as Prisma.InputJsonValue,
        ...(template
          ? { templateSnapshot: template as Prisma.InputJsonValue }
          : {}),
      },
    });
    const revision = await tx.reportRevision.create({
      data: {
        reportId: report.id,
        schoolId: context.schoolId,
        revisionNo: 1,
        contentSnapshot: content as Prisma.InputJsonValue,
        createdById: principal.userId,
        lastEditedById: principal.userId,
      },
    });
    await tx.footprintReport.update({
      where: { id: report.id },
      data: { currentRevisionId: revision.id },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "report.create",
      targetType: "FootprintReport",
      targetId: report.id,
      details: {
        runId: input.calculationRunId,
        revisionId: revision.id,
        templateVersionId: template?.id ?? null,
      },
    });
    return { ...report, currentRevisionId: revision.id };
  });
}
export async function saveReportDraft(
  principal: Principal,
  context: SchoolContext,
  reportId: string,
  input: RevisionRequest & { content: ReportContent },
) {
  requireReportPermission(context.role, "report.write");
  const content = reportContentSchema.parse(input.content);
  return db.$transaction(async (tx) => {
    const report = await tx.footprintReport.findFirst({
      where: { id: reportId, schoolId: context.schoolId },
    });
    if (!report) throw new RequestError("报告不存在", 404);
    if (report.currentRevisionId !== input.revisionId)
      throw new RequestError("报告当前修订已变化，请刷新", 409);
    const changed = await tx.reportRevision.updateMany({
      where: {
        id: input.revisionId,
        schoolId: context.schoolId,
        reportId,
        status: "DRAFT",
        contentRevision: input.expectedContentRevision,
      },
      data: {
        contentSnapshot: content as Prisma.InputJsonValue,
        contentRevision: { increment: 1 },
        lastEditedById: principal.userId,
      },
    });
    if (changed.count !== 1)
      throw new RequestError("草稿已更新或不可编辑，请刷新后重试", 409);
    await tx.footprintReport.update({
      where: { id: reportId },
      data: { updatedAt: new Date() },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "report.save",
      targetType: "ReportRevision",
      targetId: input.revisionId,
      details: { contentRevision: input.expectedContentRevision + 1 },
    });
    return tx.reportRevision.findUniqueOrThrow({
      where: { id: input.revisionId },
    });
  });
}
export async function createReportRevision(
  principal: Principal,
  context: SchoolContext,
  reportId: string,
  input: RevisionRequest,
) {
  requireReportPermission(context.role, "report.write");
  return db.$transaction(async (tx) => {
    const report = await tx.footprintReport.findFirst({
      where: { id: reportId, schoolId: context.schoolId },
    });
    if (!report) throw new RequestError("报告不存在", 404);
    if (report.currentRevisionId !== input.revisionId)
      throw new RequestError("当前修订已变化，请刷新", 409);
    const previous = await tx.reportRevision.findFirst({
      where: {
        id: input.revisionId,
        reportId,
        schoolId: context.schoolId,
        contentRevision: input.expectedContentRevision,
        status: { in: ["APPROVED", "REJECTED"] },
      },
    });
    if (!previous)
      throw new RequestError("仅可从已通过或已驳回的当前版本创建修订", 409);
    const revision = await tx.reportRevision.create({
      data: {
        reportId,
        schoolId: context.schoolId,
        revisionNo: previous.revisionNo + 1,
        contentSnapshot: previous.contentSnapshot as Prisma.InputJsonValue,
        createdById: principal.userId,
        lastEditedById: principal.userId,
      },
    });
    const moved = await tx.footprintReport.updateMany({
      where: {
        id: reportId,
        schoolId: context.schoolId,
        currentRevisionId: previous.id,
      },
      data: { currentRevisionId: revision.id },
    });
    if (moved.count !== 1) throw new RequestError("报告已被修订，请刷新", 409);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "report.revise",
      targetType: "ReportRevision",
      targetId: revision.id,
      details: { previousRevisionId: previous.id },
    });
    return revision;
  });
}
