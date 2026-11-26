import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { toModelView } from "./view";
import { findNewerModelDataItems } from "./data-item-upgrades";

export async function loadModelVersionPage(
  modelId: string,
  versionId: string,
  access: { kind: "SCHOOL"; schoolId: string } | { kind: "PLATFORM" },
) {
  if (
    !z.uuid().safeParse(modelId).success ||
    !z.uuid().safeParse(versionId).success
  )
    notFound();

  const entry = await db.modelVersion.findFirst({
    where: {
      id: versionId,
      modelId,
      ...(access.kind === "PLATFORM"
        ? { model: { scope: "PUBLIC" as const, archivedAt: null } }
        : {
            OR: [
              {
                model: {
                  scope: "SCHOOL" as const,
                  schoolId: access.schoolId,
                  archivedAt: null,
                },
              },
              {
                status: "PUBLISHED" as const,
                model: { scope: "PUBLIC" as const, archivedAt: null },
              },
            ],
          }),
    },
    include: {
      model: {
        include: {
          sourceVersion: {
            select: { version: true, model: { select: { code: true } } },
          },
        },
      },
    },
  });
  if (!entry) notFound();
  const model = toModelView({ ...entry.model, versions: [entry] });
  const version = model.versions[0];
  const newerItems =
    version.status === "DRAFT" || version.status === "REJECTED"
      ? await findNewerModelDataItems(db, version.content)
      : null;
  const dataItemsToReview = newerItems
    ? [...newerItems.values()].map(({ code, version }) => `${code} v${version}`)
    : [];
  return { model, version, dataItemsToReview };
}
