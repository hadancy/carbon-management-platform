import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import {
  deleteAccount,
  setAccountStatus,
  updateAccount,
} from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.union([
  z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }),
  z.object({ displayName: z.string().trim().min(2).max(120) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const input = inputSchema.parse(await readJson(request));
    const user =
      "status" in input
        ? await setAccountStatus(principal, request.headers, id, input.status)
        : await updateAccount(principal, id, input.displayName);
    return Response.json({
      user: { id: user.id, displayName: user.displayName, status: user.status },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    await deleteAccount(principal, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
