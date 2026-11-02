import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { createNextModelVersion } from "@/server/models/service";
import { errorResponse } from "@/server/http/response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    const version = await createNextModelVersion(principal, context, id);
    return Response.json({ version }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
