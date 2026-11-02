import { getModelRequestContext } from "@/server/models/context";
import { listPublishedDataItems } from "@/server/data-items/queries";
import { dataItemCatalogQuerySchema } from "@/shared/data-items";
import { errorResponse } from "@/server/http/response";

export async function GET(request: Request) {
  try {
    const { principal, context } = await getModelRequestContext(
      request.headers,
    );
    const query = dataItemCatalogQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(
      await listPublishedDataItems(principal, context, query),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
