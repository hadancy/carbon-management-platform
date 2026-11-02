import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { submitRevision } from "@/server/accounting/review";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  runId: z.uuid(),
  expectedInputRevision: z.number().int().positive(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const input = inputSchema.parse(await readJson(request));
    return Response.json({
      revision: await submitRevision(
        principal,
        context,
        z.uuid().parse((await params).id),
        input.runId,
        input.expectedInputRevision,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
