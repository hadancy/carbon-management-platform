import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { reviewRevision } from "@/server/accounting/review";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(2000),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const input = inputSchema.parse(await readJson(request));
    return Response.json({
      review: await reviewRevision(
        principal,
        context,
        z.uuid().parse((await params).id),
        input.decision,
        input.reason,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
