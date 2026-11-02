import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { getCase, saveCaseInputs } from "@/server/accounting/cases";
import { saveInputsSchema } from "@/shared/accounting";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await accountingContext(request.headers);
    return Response.json({
      case: await getCase(context.schoolId, z.uuid().parse((await params).id)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const input = saveInputsSchema.parse(await readJson(request));
    return Response.json({
      revision: await saveCaseInputs(
        principal,
        context,
        z.uuid().parse((await params).id),
        input.expectedInputRevision,
        input.inputs,
        input.ruleVersionId,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
