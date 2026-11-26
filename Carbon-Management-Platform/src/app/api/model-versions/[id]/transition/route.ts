import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { transitionModelVersion } from "@/server/models/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  action: z.enum(["submit", "publish", "reject"]),
  note: z.string().trim().max(2000).optional(),
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const id = z.uuid().parse((await params).id);
    const input = inputSchema.parse(await readJson(request));
    const version = await transitionModelVersion(principal, context, id, input);
    return Response.json({ version });
  } catch (error) {
    return errorResponse(error);
  }
}
