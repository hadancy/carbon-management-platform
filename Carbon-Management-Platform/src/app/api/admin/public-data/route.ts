import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePlatformAdmin } from "@/server/auth/access";
import { createPublicDataDraft } from "@/server/admin/service";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";

const inputSchema = z.object({
  type: z.enum(["EMISSION_FACTOR", "RULE_CONFIG", "REPORT_TEMPLATE"]),
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((code) => code.toUpperCase()),
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(200),
  source: z.string().trim().max(2000).optional(),
  content: z
    .record(z.string(), z.json())
    .refine((content) => Object.keys(content).length > 0),
});

export async function POST(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const input = inputSchema.parse(await readJson(request));
    const entry = await createPublicDataDraft(principal, {
      ...input,
      content: input.content as Prisma.InputJsonValue,
    });
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
