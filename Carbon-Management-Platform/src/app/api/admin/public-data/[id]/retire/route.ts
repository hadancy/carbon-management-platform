import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { retireEmissionFactor } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const input = z
      .object({ reason: z.string().trim().min(1).max(1000) })
      .parse(await readJson(request));
    const entry = await retireEmissionFactor(principal, id, input.reason);
    return Response.json({ entry });
  } catch (error) {
    return errorResponse(error);
  }
}
