import { cookies, headers } from "next/headers";
import { z } from "zod";
import { requireActiveSchoolContext } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { errorResponse } from "@/server/http/response";

export async function GET(request: Request) {
  try {
    const schoolId = (await cookies()).get("active_school")?.value;
    await requireActiveSchoolContext(await headers(), schoolId);
    const type = new URL(request.url).searchParams.get("type");
    const parsedType = type
      ? z
          .enum(["EMISSION_FACTOR", "RULE_CONFIG", "REPORT_TEMPLATE"])
          .parse(type)
      : undefined;
    const entries = await db.publicDataVersion.findMany({
      where: { status: "PUBLISHED", type: parsedType },
      select: {
        id: true,
        type: true,
        code: true,
        version: true,
        title: true,
        source: true,
        content: true,
        publishedAt: true,
        retiredAt: true,
        retirementReason: true,
      },
      orderBy: { publishedAt: "desc" },
    });
    return Response.json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}
