import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { runCalculation } from "@/server/accounting/runs";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  requestId: z.uuid(),
  mode: z.enum(["TRIAL", "PRODUCTION"]),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const input = inputSchema.parse(await readJson(request));
    const outcome = await runCalculation(
      principal,
      context,
      z.uuid().parse((await params).id),
      input.requestId,
      input.mode,
    );
    if (outcome.preflightError)
      return Response.json(
        {
          run: null,
          error: outcome.preflightError,
          diagnostics: outcome.diagnostics,
        },
        { status: 400 },
      );
    return Response.json(outcome, { status: outcome.run ? 201 : 422 });
  } catch (error) {
    return errorResponse(error);
  }
}
