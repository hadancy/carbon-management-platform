import { db } from "@/server/db/client";
import { logFailure } from "@/server/http/log";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    // Validate connectivity and the latest required schema without returning rows.
    await db.$queryRaw`SELECT "templateSnapshot" FROM "FootprintReport" LIMIT 0`;
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const requestId = logFailure("readiness.database", error);
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  }
}
