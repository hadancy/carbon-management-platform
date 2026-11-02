import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { dataItemFields, deleteDataItemSchema } from "@/shared/data-items";
import { dataItemUsageCounts } from "./usage";

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
      await tx.$queryRaw`SELECT "id" FROM "DataItemVersion" WHERE "id" = ${id}::uuid FOR UPDATE`;
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
      await audit(tx, {
        actorId: principal.userId,
        action: "data-item.delete",
        targetType: "DataItemVersion",
        targetId: id,
        details: {
          dataItemId: entry.dataItemId,
          code: entry.dataItem.code,
          version: entry.version,
          dataItemDeleted: remaining === 0,
          snapshot: {
            ...dataItemFields(entry),
            status: entry.status,
            publishedAt: entry.publishedAt?.toISOString() ?? null,
            retiredAt: entry.retiredAt?.toISOString() ?? null,
            retirementReason: entry.retirementReason,
          },
        },
      });
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
