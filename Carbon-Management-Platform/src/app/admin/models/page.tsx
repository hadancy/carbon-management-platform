import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { listPublicModels } from "@/server/models/service";
import { toModelView } from "@/server/models/view";
import { ModelWorkbench } from "@/components/models/model-workbench";

export default async function PublicModelsPage() {
  await requirePlatformAdmin(await headers());
  const models = await listPublicModels();
  return (
    <ModelWorkbench
      scope="PUBLIC"
      models={models.map(toModelView)}
      canWrite
      canReview
    />
  );
}
