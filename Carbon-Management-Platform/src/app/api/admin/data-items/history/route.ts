import { requirePlatformAdmin } from "@/server/auth/access";
import { listDataItemHistory } from "@/server/data-items/admin-queries";
import { errorResponse } from "@/server/http/response";
import { dataItemHistoryQuerySchema } from "@/shared/data-items";

export async function GET(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const query = dataItemHistoryQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listDataItemHistory(principal, query));
  } catch (error) {
    return errorResponse(error);
  }
}
