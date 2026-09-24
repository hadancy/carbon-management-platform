import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { resetAccountPassword } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({ newPassword: z.string().min(12).max(128) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const { newPassword } = inputSchema.parse(await readJson(request));
    await resetAccountPassword(principal, request.headers, id, newPassword);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
