import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { saveModelVersion } from "@/server/models/service";
import { deleteDraftModelVersion } from "@/server/models/deletion";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { modelContentSchema } from "@/shared/models";

const saveSchema = modelContentSchema.extend({
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    const { expectedUpdatedAt, ...content } = saveSchema.parse(
      await readJson(request),
    );
    const version = await saveModelVersion(
      principal,
      context,
      id,
      content,
      expectedUpdatedAt,
    );
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
