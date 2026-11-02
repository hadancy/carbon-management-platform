import "server-only";
import type {
  FootprintReport,
  ReportRevision,
} from "@/generated/prisma/client";
import { RequestError } from "@/server/http/response";
import {
  REPORT_TEMPLATE_VERSIONS,
  reportContentSchema,
} from "@/shared/reports";
import { parseReportSource } from "@/domain/reports/snapshot";
import { publicTemplateSnapshotSchema } from "@/shared/report-template";
import { buildReportDocument } from "@/domain/reports/document";
import { reportContentHash } from "./context";

export function revisionDocument(
  revision: ReportRevision & { report: FootprintReport },
) {
  const report = revision.report;
  if (
    !REPORT_TEMPLATE_VERSIONS.some(
      (version) => version === report.templateVersion,
    )
  )
    throw new RequestError("当前报告模板版本不可渲染", 409);
  const source = parseReportSource(report.sourceSnapshot);
  const content = reportContentSchema.parse(revision.contentSnapshot);
  if (
    revision.status !== "DRAFT" &&
    revision.contentHash !==
      reportContentHash(
        report.id,
        revision.revisionNo,
        report.templateVersion,
        source,
        content,
        report.templateSnapshot,
      )
  )
    throw new RequestError("报告冻结摘要不一致", 409);
  return buildReportDocument(
    {
      templateSnapshot: report.templateSnapshot
        ? publicTemplateSnapshotSchema.parse(report.templateSnapshot)
        : null,
      code: report.code,
      revisionNo: revision.revisionNo,
      templateVersion: report.templateVersion,
      status: revision.status,
      contentHash: revision.contentHash,
      reviewerName: revision.reviewerName,
      reviewReason: revision.reviewReason,
      reviewedAt: revision.reviewedAt?.toISOString() ?? null,
    },
    content,
    source,
  );
}
