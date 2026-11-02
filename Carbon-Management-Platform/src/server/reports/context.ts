import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { requireActiveSchoolContext } from "@/server/auth/access";
import { RequestError } from "@/server/http/response";
import { canSchool, type SchoolAction } from "@/shared/permissions";
import { publicTemplateSnapshotSchema } from "@/shared/report-template";
import type { ReportContent } from "@/shared/reports";
import type { ReportSource } from "@/domain/reports/snapshot";

export async function reportContext(headers: Headers) {
  return requireActiveSchoolContext(
    headers,
    (await cookies()).get("active_school")?.value,
  );
}
export function requireReportPermission(role: string, action: SchoolAction) {
  if (!canSchool(role, action)) throw new RequestError("无此报告操作权限", 403);
}
export function reportContentHash(
  reportId: string,
  revisionNo: number,
  templateVersion: string,
  source: ReportSource,
  content: ReportContent,
  templateSnapshot?: unknown,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        reportId,
        revisionNo,
        templateVersion,
        source,
        content,
        ...(templateSnapshot
          ? {
              templateSnapshot:
                publicTemplateSnapshotSchema.parse(templateSnapshot),
            }
          : {}),
      }),
    )
    .digest("hex");
}
