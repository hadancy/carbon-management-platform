import { requirePlatformAdmin } from "@/server/auth/access";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { listDataItems, toDataItemEntry } from "@/server/data-items/queries";
import { createDataItem } from "@/server/data-items/service";
import { dataItemListQuerySchema } from "@/shared/data-items";

export async function GET(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const query = dataItemListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listDataItems(principal, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const entry = await createDataItem(principal, await readJson(request));
    return Response.json({ entry: toDataItemEntry(entry) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
