import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { createSchool } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((code) => code.toUpperCase()),
  name: z.string().trim().min(2).max(200),
});

export async function POST(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const input = inputSchema.parse(await readJson(request));
    const school = await createSchool(principal, input);
    return Response.json({ school }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
