import { z } from "zod";
import { reportContext } from "@/server/reports/context";
import { getReport } from "@/server/reports/queries";
import { saveReportDraft } from "@/server/reports/drafts";
import { saveReportSchema } from "@/shared/reports";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await reportContext(request.headers);
    return Response.json(
      {
        report: await getReport(
          context.schoolId,
          z.uuid().parse((await params).id),
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await reportContext(request.headers);
    const input = saveReportSchema.parse(await readJson(request));
    return Response.json({
      revision: await saveReportDraft(
        principal,
        context,
        z.uuid().parse((await params).id),
        input,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
