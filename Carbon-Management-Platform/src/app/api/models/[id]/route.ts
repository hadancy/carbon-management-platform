import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { archiveModel } from "@/server/models/deletion";
import { errorResponse } from "@/server/http/response";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    return Response.json(await archiveModel(principal, context, id));
  } catch (error) {
    return errorResponse(error);
  }
}
