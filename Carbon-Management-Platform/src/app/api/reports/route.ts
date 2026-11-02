import { reportContext } from "@/server/reports/context";
import { listReports, listApprovedReportRuns } from "@/server/reports/queries";
import { createReport } from "@/server/reports/drafts";
import { createReportSchema } from "@/shared/reports";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function GET(request: Request) {
  try {
    const { context } = await reportContext(request.headers);
    const [reports, runs] = await Promise.all([
      listReports(context.schoolId),
      listApprovedReportRuns(context.schoolId),
    ]);
    return Response.json(
      {
        reports,
        approvedRuns: runs.map((run) => ({
          id: run.id,
          caseId: run.revision.caseId,
          caseCode: run.revision.case.code,
          product: run.revision.case.product,
          revisionNo: run.revision.revisionNo,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { principal, context } = await reportContext(request.headers);
    const input = createReportSchema.parse(await readJson(request));
    return Response.json(
      { report: await createReport(principal, context, input) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
