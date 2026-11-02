import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { createRevision } from "@/server/accounting/cases";
import { errorResponse } from "@/server/http/response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    return Response.json(
      {
        revision: await createRevision(
          principal,
          context,
          z.uuid().parse((await params).id),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
