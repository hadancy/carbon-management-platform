import { z } from "zod";
import { getModelRequestContext } from "@/server/models/context";
import { createModel } from "@/server/models/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { modelContentSchema } from "@/shared/models";

const inputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((code) => code.toUpperCase()),
  sourceVersionId: z.uuid().optional(),
  content: modelContentSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const input = inputSchema.parse(await readJson(request));
    const model = await createModel(principal, context, {
      ...input,
      scope: "SCHOOL",
    });
    return Response.json({ model }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
