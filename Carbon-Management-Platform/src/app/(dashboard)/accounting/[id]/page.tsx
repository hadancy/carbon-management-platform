import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { getCase } from "@/server/accounting/cases";
import { db } from "@/server/db/client";
import { canSchool } from "@/shared/permissions";
import { AccountingEditor } from "@/components/accounting/accounting-editor";
import type { CaseView } from "@/components/accounting/types";
import { calculationFactorSchema } from "@/shared/emission-factors";
import { pvRuleSchema } from "@/shared/calculation-rule";
import { RequestError } from "@/server/http/response";

export default async function AccountingCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requirePrincipal(await headers());
  const context = await getActiveSchoolContext(
    principal,
    (await cookies()).get("active_school")?.value,
  );
  if (!context) redirect("/no-school");
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const [entry, factors, rules] = await Promise.all([
    getCase(context.schoolId, id).catch((error: unknown) => {
      if (error instanceof RequestError && error.status === 404) notFound();
      throw error;
    }),
    db.publicDataVersion.findMany({
      where: { type: "EMISSION_FACTOR", status: "PUBLISHED", retiredAt: null },
      orderBy: { publishedAt: "desc" },
    }),
    db.publicDataVersion.findMany({
      where: { type: "RULE_CONFIG", status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    }),
  ]);
  return (
    <AccountingEditor
      key={`${entry.id}:${entry.currentRevisionId}:${entry.revisions.find((revision) => revision.id === entry.currentRevisionId)?.inputRevision}:${entry.revisions.find((revision) => revision.id === entry.currentRevisionId)?.status}:${entry.revisions.find((revision) => revision.id === entry.currentRevisionId)?.runs.length}`}
      entry={JSON.parse(JSON.stringify(entry)) as CaseView}
      factors={factors.flatMap((factor) => {
        const parsed = calculationFactorSchema.safeParse(factor.content);
        return parsed.success
          ? [
              {
                id: factor.id,
                label: `${factor.title} · ${factor.code} v${factor.version} · ${parsed.data.purpose === "TEST" ? "测试" : "正式"}`,
                stage: parsed.data.applicability.stage,
                unit: parsed.data.activityUnit,
                subject: parsed.data.applicability.subject,
                purpose: parsed.data.purpose,
              },
            ]
          : [];
      })}
      rules={rules.flatMap((rule) => {
        const parsed = pvRuleSchema.safeParse(rule.content);
        return parsed.success
          ? [
              {
                id: rule.id,
                label: `${rule.title} · v${rule.version} · ${parsed.data.purpose === "TEST" ? "测试" : "正式"}`,
              },
            ]
          : [];
      })}
      canWrite={canSchool(context.role, "accounting.write")}
      canReview={canSchool(context.role, "accounting.review")}
      currentUserId={principal.userId}
    />
  );
}
