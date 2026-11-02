import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { readJson } from "@/server/http/json";
import { errorResponse } from "@/server/http/response";
import { toDataItemEntry } from "@/server/data-items/queries";
import { updateDataItem } from "@/server/data-items/service";
import { deleteDataItem } from "@/server/data-items/deletion";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    const entry = await updateDataItem(principal, id, await readJson(request));
    return Response.json({ entry: toDataItemEntry(entry) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePlatformAdmin(request.headers);
    const id = z.uuid().parse((await params).id);
    return Response.json(
      await deleteDataItem(principal, id, await readJson(request)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
