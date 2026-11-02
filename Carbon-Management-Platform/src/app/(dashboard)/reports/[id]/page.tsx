import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { RequestError } from "@/server/http/response";
import { getReport } from "@/server/reports/queries";
import { parseReportSource } from "@/domain/reports/snapshot";
import { reportContentSchema } from "@/shared/reports";
import { ReportWorkbench } from "@/components/reports/report-workbench";
import type { ReportView } from "@/components/reports/types";
import { canSchool } from "@/shared/permissions";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requirePrincipal(await headers());
  const context = await getActiveSchoolContext(
    principal,
    (await cookies()).get("active_school")?.value,
  );
  if (!context) redirect("/no-school");
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const report = await getReport(context.schoolId, parsed.data).catch(
    (error: unknown) => {
      if (error instanceof RequestError && error.status === 404) notFound();
      throw error;
    },
  );
  const entry = {
    ...report,
    sourceSnapshot: parseReportSource(report.sourceSnapshot),
    revisions: report.revisions.map((revision) => ({
      ...revision,
      contentSnapshot: reportContentSchema.parse(revision.contentSnapshot),
    })),
  };
  return (
    <ReportWorkbench
      key={report.id + ":" + report.updatedAt.toISOString()}
      initialEntry={JSON.parse(JSON.stringify(entry)) as ReportView}
      currentUserId={principal.userId}
      canWrite={canSchool(context.role, "report.write")}
      canReview={canSchool(context.role, "report.review")}
      canExport={canSchool(context.role, "report.export")}
    />
  );
}
