import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { loadModelVersionPage } from "@/server/models/version-page";
import { canSchool } from "@/shared/permissions";
import { ModelVersionEditor } from "@/components/models/model-version-editor";

export default async function SchoolModelVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const principal = await requirePrincipal(await headers());
  const selectedSchoolId = (await cookies()).get("active_school")?.value;
  const context = await getActiveSchoolContext(principal, selectedSchoolId);
  if (!context) redirect("/no-school");
  const { id, versionId } = await params;
  const { model, version } = await loadModelVersionPage(id, versionId, {
    kind: "SCHOOL",
    schoolId: context.schoolId,
  });

  return (
    <ModelVersionEditor
      key={version.id}
      model={model}
      version={version}
      canWrite={
        model.scope === "SCHOOL" && canSchool(context.role, "model.write")
      }
      canReview={
        model.scope === "SCHOOL" && canSchool(context.role, "model.publish")
      }
      currentUserId={principal.userId}
      backHref="/models"
    />
  );
}
