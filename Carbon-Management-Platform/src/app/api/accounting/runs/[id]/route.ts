import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { db } from "@/server/db/client";
import { RequestError, errorResponse } from "@/server/http/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await accountingContext(request.headers);
    const id = z.uuid().parse((await params).id);
    const run = await db.calculationRun.findFirst({
      where: { id, schoolId: context.schoolId },
    });
    if (!run) throw new RequestError("计算运行不存在", 404);
    return Response.json(
      { run },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
