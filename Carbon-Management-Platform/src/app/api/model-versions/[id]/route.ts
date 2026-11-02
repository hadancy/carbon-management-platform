import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { saveModelVersion } from "@/server/models/service";
import { deleteDraftModelVersion } from "@/server/models/deletion";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { modelContentSchema } from "@/shared/models";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    const content = modelContentSchema.parse(await readJson(request));
    const version = await saveModelVersion(principal, context, id, content);
    return Response.json({ version });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    return Response.json(await deleteDraftModelVersion(principal, context, id));
  } catch (error) {
    return errorResponse(error);
  }
}
