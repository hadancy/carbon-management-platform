import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { SCHOOL_ROLES } from "@/shared/permissions";
import { removeMembership, setMembership } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  userId: z.uuid(),
  schoolId: z.uuid(),
  role: z.enum(SCHOOL_ROLES),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function POST(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const input = inputSchema.parse(await readJson(request));
    const membership = await setMembership(principal, input);
    return Response.json({ membership });
  } catch (error) {
    return errorResponse(error);
  }
}

const deleteSchema = z.object({ userId: z.uuid(), schoolId: z.uuid() });

export async function DELETE(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const input = deleteSchema.parse(await readJson(request));
    await removeMembership(principal, input.userId, input.schoolId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
