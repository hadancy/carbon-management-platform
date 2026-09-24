import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { readJson } from "@/server/http/json";
import { RequestError, errorResponse } from "@/server/http/response";

const inputSchema = z.object({ schoolId: z.uuid() });

export async function POST(request: Request) {
  try {
    const principal = await requirePrincipal(request.headers);
    const { schoolId } = inputSchema.parse(await readJson(request));
    const membership = await db.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId: principal.userId } },
      include: { school: true },
    });
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      membership.school.status !== "ACTIVE"
    ) {
      throw new RequestError("无权切换到该学校", 403);
    }

    const response = NextResponse.json({ schoolId });
    response.cookies.set("active_school", schoolId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
