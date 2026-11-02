import { z } from "zod";
import { reportContext } from "@/server/reports/context";
import { createReportRevision } from "@/server/reports/drafts";
import { reportRevisionRequestSchema } from "@/shared/reports";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await reportContext(request.headers);
    const input = reportRevisionRequestSchema.parse(await readJson(request));
    return Response.json(
      {
        revision: await createReportRevision(
          principal,
          context,
          z.uuid().parse((await params).id),
          input,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
