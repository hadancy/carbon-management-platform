import { z } from "zod";
import { reportContext } from "@/server/reports/context";
import { reportPdfFile } from "@/server/reports/exports";
import { errorResponse } from "@/server/http/response";

export const runtime = "nodejs";
export const maxDuration = 60;
async function respond(
  request: Request,
  params: Promise<{ id: string }>,
  generate: boolean,
) {
  try {
    const { principal, context } = await reportContext(request.headers);
    const { file, name } = await reportPdfFile(
      principal,
      context,
      z.uuid().parse((await params).id),
      generate,
    );
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + name + '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Report-Content-Hash": file.contentHash,
        "X-PDF-File-Hash": file.fileHash,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(request, params, true);
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(request, params, false);
}
