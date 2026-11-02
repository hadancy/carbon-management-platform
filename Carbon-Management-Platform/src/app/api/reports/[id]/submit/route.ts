import { z } from "zod";
import { reportContext } from "@/server/reports/context";
import { transitionReport } from "@/server/reports/review";
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
    return Response.json({
      revision: await transitionReport(
        principal,
        context,
        z.uuid().parse((await params).id),
        "submit",
        input,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
