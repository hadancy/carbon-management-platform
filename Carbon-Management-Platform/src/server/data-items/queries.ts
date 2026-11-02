import "server-only";
import type { DataItemVersion, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { RequestError } from "@/server/http/response";
import { dataItemUsageCounts } from "./usage";
import {
  dataItemListQuerySchema,
  dataItemCatalogQuerySchema,
  type DataItemCatalogQuery,
  type DataItemEntry,
  type DataItemListQuery,
} from "@/shared/data-items";

export function toDataItemEntry(
  entry: DataItemVersion & { dataItem: { code: string } },
): DataItemEntry {
  return {
    id: entry.id,
    dataItemId: entry.dataItemId,
    code: entry.dataItem.code,
    version: entry.version,
    revision: entry.revision,
    status: entry.status,
    dataName: entry.dataName,
    specModel: entry.specModel,
    manufacturer: entry.manufacturer,
    carbonFootprintFactor: entry.carbonFootprintFactor,
    functionalUnit: entry.functionalUnit,
    emissionFactor: entry.emissionFactor,
    factorSource: entry.factorSource,
    dataSource: entry.dataSource,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    retiredAt: entry.retiredAt?.toISOString() ?? null,
    retirementReason: entry.retirementReason,
  };
}

export async function listDataItems(
  principal: Principal,
  input: DataItemListQuery,
) {
  if (!principal.isPlatformAdmin)
    throw new RequestError("无数据项管理权限", 403);
  const query = dataItemListQuerySchema.parse(input);
  const list = await queryDataItems(query);
  const counts = await dataItemUsageCounts(
    db,
    list.entries.map((entry) => entry.id),
  );
  return {
    ...list,
    entries: list.entries.map((entry) => ({
      ...entry,
      referenceCount: counts.get(entry.id) ?? 0,
    })),
  };
}

export async function listPublishedDataItems(
  principal: Principal,
  context: SchoolContext | null,
  input: DataItemCatalogQuery,
) {
  if (
    !principal.isPlatformAdmin &&
    (!context || context.userId !== principal.userId)
  )
    throw new RequestError("未分配可用学校", 403);
  const query = dataItemCatalogQuerySchema.parse(input);
  return queryDataItems({ ...query, status: "PUBLISHED" });
}

async function queryDataItems(query: DataItemListQuery) {
  const where: Prisma.DataItemVersionWhereInput = {
    ...(query.status === "DRAFT" ? { status: "DRAFT" } : {}),
    ...(query.status === "PUBLISHED"
      ? { status: "PUBLISHED", retiredAt: null }
      : {}),
    ...(query.status === "RETIRED" ? { retiredAt: { not: null } } : {}),
    ...(query.unit ? { functionalUnit: query.unit } : {}),
    ...(query.q
      ? {
          OR: [
            { dataItem: { code: { contains: query.q, mode: "insensitive" } } },
            { dataName: { contains: query.q, mode: "insensitive" } },
            { specModel: { contains: query.q, mode: "insensitive" } },
            { manufacturer: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.$transaction(
    async (tx) => {
      const total = await tx.dataItemVersion.count({ where });
      const page = Math.min(
        query.page,
        Math.max(1, Math.ceil(total / query.pageSize)),
      );
      const entries = await tx.dataItemVersion.findMany({
        where,
        include: { dataItem: { select: { code: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        entries: entries.map(toDataItemEntry),
        total,
        query: { ...query, page },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
