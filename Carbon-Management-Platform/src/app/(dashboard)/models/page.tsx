import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";
import { listSchoolModels } from "@/server/models/service";
import { toModelView } from "@/server/models/view";
import { canSchool } from "@/shared/permissions";
import { ModelWorkbench } from "@/components/models/model-workbench";

export default async function ModelsPage() {
  const principal = await requirePrincipal(await headers());
  const selectedSchoolId = (await cookies()).get("active_school")?.value;
  const context = await getActiveSchoolContext(principal, selectedSchoolId);
  if (!context) redirect("/no-school");
  const { schoolModels, publicModels } = await listSchoolModels(
    context.schoolId,
  );

  return (
    <ModelWorkbench
      scope="SCHOOL"
      models={schoolModels.map(toModelView)}
      publicModels={publicModels.map(toModelView)}
      canWrite={canSchool(context.role, "model.write")}
      canReview={canSchool(context.role, "model.publish")}
    />
  );
}
