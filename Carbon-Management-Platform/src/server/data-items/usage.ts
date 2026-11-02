import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { ModelContent } from "@/shared/models";

export async function recordModelDataItemUsage(
  tx: Prisma.TransactionClient,
  modelVersionId: string,
  content: ModelContent,
) {
  const ids = [
    ...new Set(
      content.stages.flatMap((stage) =>
        stage.categories.flatMap((category) =>
          category.items.flatMap((item) =>
            item.librarySource ? [item.librarySource.versionId] : [],
          ),
        ),
      ),
    ),
  ];
  if (!ids.length) return;
  await tx.dataItemUsage.createMany({
    data: ids.map((dataItemVersionId) => ({
      dataItemVersionId,
      modelVersionId,
    })),
    skipDuplicates: true,
  });
}

/** Count historical usage plus stored model references, including archived models. */
export async function dataItemUsageCounts(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  ids: string[],
) {
  if (!ids.length) return new Map<string, number>();
  const selected = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  const rows = await client.$queryRaw<
    { id: string; count: number }[]
  >(Prisma.sql`
    WITH usage_records AS (
      SELECT "dataItemVersionId" AS id, "modelVersionId" FROM "DataItemUsage" WHERE "dataItemVersionId" IN (${selected})
      UNION
      SELECT version.id, model.id FROM "ModelVersion" model
      CROSS JOIN LATERAL jsonb_path_query(model.content, '$.stages[*].categories[*].items[*].librarySource.versionId') AS reference(value)
      JOIN "DataItemVersion" version ON version.id::text = reference.value #>> '{}'
      WHERE version.id IN (${selected})
    )
    SELECT id, count(*)::int AS count FROM usage_records GROUP BY id
  `);
  return new Map(rows.map((row) => [row.id, row.count]));
}
