import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { listReports, listApprovedReportRuns } from "@/server/reports/queries";
import { ReportList } from "@/components/reports/report-list";
import { reportContentSchema } from "@/shared/reports";
import { parseReportSource } from "@/domain/reports/snapshot";
import { db } from "@/server/db/client";
import { publicReportTemplateSchema } from "@/shared/report-template";
import { canSchool } from "@/shared/permissions";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string }>;
}) {
  const principal = await requirePrincipal(await headers());
  const context = await getActiveSchoolContext(
    principal,
    (await cookies()).get("active_school")?.value,
  );
  if (!context) redirect("/no-school");
  const [reports, runs, query, templates] = await Promise.all([
    listReports(context.schoolId),
    listApprovedReportRuns(context.schoolId),
    searchParams,
    db.publicDataVersion.findMany({
      where: { type: "REPORT_TEMPLATE", status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    }),
  ]);
  return (
    <ReportList
      canWrite={canSchool(context.role, "report.write")}
      initialRunId={query.runId}
      templates={templates
        .filter(
          (item) => publicReportTemplateSchema.safeParse(item.content).success,
        )
        .map((item) => ({
          id: item.id,
          label: `${item.title} · ${item.code} v${item.version}`,
        }))}
      rows={reports.flatMap((report) =>
        report.currentRevision
          ? [
              {
                id: report.id,
                code: report.code,
                title: reportContentSchema.parse(
                  report.currentRevision.contentSnapshot,
                ).title,
                caseCode: parseReportSource(report.sourceSnapshot)
                  .accountingCase.code,
                status: report.currentRevision.status,
                revisionNo: report.currentRevision.revisionNo,
                updatedAt: report.updatedAt.toISOString(),
              },
            ]
          : [],
      )}
      runs={runs.map((run) => ({
        id: run.id,
        caseId: run.revision.caseId,
        caseCode: run.revision.case.code,
        product: run.revision.case.product,
        revisionNo: run.revision.revisionNo,
      }))}
    />
  );
}
