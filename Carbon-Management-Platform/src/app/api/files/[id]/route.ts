import { z } from "zod";
import { accountingContext } from "@/server/accounting/context";
import { getAsset } from "@/server/files/service";
import { errorResponse } from "@/server/http/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await accountingContext(request.headers);
    const asset = await getAsset(
      context.schoolId,
      z.uuid().parse((await params).id),
    );
    return new Response(new Uint8Array(asset.content), {
      headers: {
        "Content-Type": asset.mediaType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
        "Content-Length": String(asset.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
