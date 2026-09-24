import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { SCHOOL_ROLES } from "@/shared/permissions";
import { createAccount } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  schoolId: z.uuid(),
  role: z.enum(SCHOOL_ROLES),
});

export async function POST(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const input = inputSchema.parse(await readJson(request));
    const user = await createAccount(principal, request.headers, input);
    return Response.json(
      { user: { id: user.id, email: user.email } },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
