import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { listCases } from "@/server/accounting/cases";
import { db } from "@/server/db/client";
import { canSchool } from "@/shared/permissions";
import { AccountingList } from "@/components/accounting/accounting-list";

export default async function AccountingPage() {
  const principal = await requirePrincipal(await headers());
  const context = await getActiveSchoolContext(
    principal,
    (await cookies()).get("active_school")?.value,
  );
  if (!context) redirect("/no-school");
  const [cases, versions] = await Promise.all([
    listCases(context.schoolId),
    db.modelVersion.findMany({
      where: {
        status: "PUBLISHED",
        model: {
          scope: "SCHOOL",
          schoolId: context.schoolId,
          archivedAt: null,
        },
      },
      include: { model: { select: { code: true } } },
      orderBy: { publishedAt: "desc" },
    }),
  ]);
  return (
    <AccountingList
      cases={cases.map((entry) => ({
        id: entry.id,
        code: entry.code,
        product: entry.product,
        currentRevisionId: entry.currentRevisionId,
        status:
          entry.revisions.find(
            (revision) => revision.id === entry.currentRevisionId,
          )?.status ?? "DRAFT",
        updatedAt: entry.updatedAt.toISOString(),
      }))}
      models={versions.map((version) => ({
        id: version.id,
        label: `${version.model.code} v${version.version}`,
      }))}
      canWrite={canSchool(context.role, "accounting.write")}
      canReview={canSchool(context.role, "accounting.review")}
    />
  );
}
