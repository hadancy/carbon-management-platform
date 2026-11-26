import "server-only";
import { Prisma, type DataItemVersion } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { dataItemFields, deleteDataItemSchema } from "@/shared/data-items";
import { dataItemUsageCounts } from "./usage";

type DeletionEntry = DataItemVersion & { dataItem: { code: string } };

async function lockVersionsForDeletion(
  tx: Prisma.TransactionClient,
  ids: string[],
) {
  const selected = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "DataItemVersion" WHERE "id" IN (${selected}) ORDER BY "id" FOR UPDATE
  `);
}

async function auditVersionDeletion(
  tx: Prisma.TransactionClient,
  actorId: string,
  entry: DeletionEntry,
  dataItemDeleted: boolean,
  replacement?: Pick<DataItemVersion, "id" | "version">,
) {
  await audit(tx, {
    actorId,
    action: "data-item.delete",
    targetType: "DataItemVersion",
    targetId: entry.id,
    details: {
      dataItemId: entry.dataItemId,
      code: entry.dataItem.code,
      version: entry.version,
      dataItemDeleted,
      ...(replacement && {
        replacedByVersionId: replacement.id,
        reason: `由 v${replacement.version} 接替，旧版从未被引用`,
      }),
      snapshot: {
        ...dataItemFields(entry),
        status: entry.status,
        revision: entry.revision,
        createdById: entry.createdById,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        publishedAt: entry.publishedAt?.toISOString() ?? null,
        retiredAt: entry.retiredAt?.toISOString() ?? null,
        retirementReason: entry.retirementReason,
      },
    },
  });
}

// Publication holds the data item lock and has retired older versions.
export async function deleteUnusedSupersededVersions(
  tx: Prisma.TransactionClient,
  actorId: string,
  replacement: Pick<DataItemVersion, "id" | "dataItemId" | "version">,
) {
  const candidates = await tx.dataItemVersion.findMany({
    where: {
      dataItemId: replacement.dataItemId,
      version: { lt: replacement.version },
      status: "PUBLISHED",
      retiredAt: { not: null },
      usages: { none: {} },
    },
    include: { dataItem: { select: { code: true } } },
    orderBy: { version: "asc" },
  });
  if (!candidates.length) return [];

  // The write lock serializes new reference records before the final check.
  const ids = candidates.map(({ id }) => id);
  await lockVersionsForDeletion(tx, ids);
  const counts = await dataItemUsageCounts(tx, ids);
  const unused = candidates.filter(({ id }) => (counts.get(id) ?? 0) === 0);
  if (!unused.length) return [];
  const result = await tx.dataItemVersion.deleteMany({
    where: { id: { in: unused.map(({ id }) => id) } },
  });
  if (result.count !== unused.length)
    throw new RequestError("旧数据项版本已变化，请刷新后重试", 409);
  for (const entry of unused)
    await auditVersionDeletion(tx, actorId, entry, false, replacement);
  return unused.map(({ version }) => version);
}

export async function deleteDataItem(
  principal: Principal,
  id: string,
  input: unknown,
) {
  if (!principal.isPlatformAdmin)
    throw new RequestError("无数据项管理权限", 403);
  const { revision } = deleteDataItemSchema.parse(input);
  try {
    return await db.$transaction(async (tx) => {
      const initial = await tx.dataItemVersion.findUnique({
        where: { id },
        select: { dataItemId: true },
      });
      if (!initial) throw new RequestError("数据项版本不存在或已删除", 404);
      // Match the identity lock used to allocate versions; then serialize with new model references.
      await tx.$queryRaw`SELECT "id" FROM "DataItem" WHERE "id" = ${initial.dataItemId}::uuid FOR UPDATE`;
      await lockVersionsForDeletion(tx, [id]);
      const entry = await tx.dataItemVersion.findUnique({
        where: { id },
        include: { dataItem: { select: { code: true } } },
      });
      if (!entry) throw new RequestError("数据项版本不存在或已删除", 404);
      if (entry.revision !== revision)
        throw new RequestError("数据项状态已变化，请刷新后重新确认删除", 409);
      const counts = await dataItemUsageCounts(tx, [id]);
      if ((counts.get(id) ?? 0) > 0)
        throw new RequestError(
          "该版本已被模型引用（包括历史和已移除的引用），只能停用，不能删除",
          409,
        );
      await tx.dataItemVersion.delete({ where: { id } });
      const remaining = await tx.dataItemVersion.count({
        where: { dataItemId: entry.dataItemId },
      });
      if (!remaining)
        await tx.dataItem.delete({ where: { id: entry.dataItemId } });
      await auditVersionDeletion(tx, principal.userId, entry, remaining === 0);
      return { deleted: true, dataItemDeleted: remaining === 0 };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      throw new RequestError("该版本存在引用记录，只能停用，不能删除", 409);
    throw error;
  }
}
