import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { toDataItemEntry } from "@/server/data-items/queries";
import { publishDataItem } from "@/server/data-items/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const entry = await publishDataItem(principal, id, await readJson(request));
    return Response.json({ entry: toDataItemEntry(entry) });
  } catch (error) {
    return errorResponse(error);
  }
}
