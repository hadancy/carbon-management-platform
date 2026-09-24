import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { setSchoolStatus, updateSchool } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.union([
  z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }),
  z.object({ name: z.string().trim().min(2).max(200) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const input = inputSchema.parse(await readJson(request));
    const school =
      "status" in input
        ? await setSchoolStatus(principal, id, input.status)
        : await updateSchool(principal, id, input.name);
    return Response.json({ school });
  } catch (error) {
    return errorResponse(error);
  }
}
