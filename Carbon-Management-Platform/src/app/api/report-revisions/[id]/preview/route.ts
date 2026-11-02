import { z } from "zod";
import { reportContext } from "@/server/reports/context";
import { getReportRevision } from "@/server/reports/queries";
import { revisionDocument } from "@/server/reports/rendering";
import { renderReportHtml } from "@/domain/reports/template";
import { errorResponse } from "@/server/http/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await reportContext(request.headers);
    const revision = await getReportRevision(
      context.schoolId,
      z.uuid().parse((await params).id),
    );
    return new Response(renderReportHtml(revisionDocument(revision)), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
