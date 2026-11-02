import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { loadModelVersionPage } from "@/server/models/version-page";
import { ModelVersionEditor } from "@/components/models/model-version-editor";

export default async function PublicModelVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const principal = await requirePlatformAdmin(await headers());
  const { id, versionId } = await params;
  const { model, version } = await loadModelVersionPage(id, versionId, {
    kind: "PLATFORM",
  });

  return (
    <ModelVersionEditor
      key={version.id}
      model={model}
      version={version}
      canWrite
      canReview
      currentUserId={principal.userId}
      backHref="/admin/models"
    />
  );
}
