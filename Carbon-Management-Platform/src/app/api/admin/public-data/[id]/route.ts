import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePlatformAdmin } from "@/server/auth/access";
import { updatePublicDataDraft } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  source: z.string().trim().max(2000).optional(),
  content: z
    .record(z.string(), z.json())
    .refine((content) => Object.keys(content).length > 0),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const input = inputSchema.parse(await readJson(request));
    const entry = await updatePublicDataDraft(principal, id, {
      ...input,
      content: input.content as Prisma.InputJsonValue,
    });
    return Response.json({ entry });
  } catch (error) {
    return errorResponse(error);
  }
}
