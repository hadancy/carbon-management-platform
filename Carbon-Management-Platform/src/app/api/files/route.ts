import { accountingContext } from "@/server/accounting/context";
import { listAssets, uploadAsset } from "@/server/files/service";
import { z } from "zod";
import { RequestError, errorResponse } from "@/server/http/response";

export async function GET(request: Request) {
  try {
    const { context } = await accountingContext(request.headers);
    const rawIds = new URL(request.url).searchParams.get("ids");
    const ids = rawIds
      ? z.array(z.uuid()).max(20).parse(rawIds.split(","))
      : undefined;
    return Response.json({ assets: await listAssets(context.schoolId, ids) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { principal, context } = await accountingContext(request.headers);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new RequestError("请选择附件", 400);
    return Response.json(
      { asset: await uploadAsset(principal, context, file) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
