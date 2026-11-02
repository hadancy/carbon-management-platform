import { createCaseSchema } from "@/shared/accounting";
import { accountingContext } from "@/server/accounting/context";
import { createCase, listCases } from "@/server/accounting/cases";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function GET(request: Request) {
  try {
    const { context } = await accountingContext(request.headers);
    return Response.json({ cases: await listCases(context.schoolId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const input = createCaseSchema.parse(await readJson(request));
    return Response.json(
      { case: await createCase(principal, context, input) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
