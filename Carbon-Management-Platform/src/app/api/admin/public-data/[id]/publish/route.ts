import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { publishPublicData } from "@/server/admin/service";
import { errorResponse } from "@/server/http/response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const entry = await publishPublicData(principal, id);
    return Response.json({ entry });
  } catch (error) {
    return errorResponse(error);
  }
}
