import "server-only";
import type { Principal } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import type {
  AdminDataItemGroup,
  AdminDataItemGroups,
  AdminDataItemHistory,
  DataItemHistoryQuery,
  DataItemListQuery,
} from "@/shared/data-items";
import {
  dataItemVersionFilter,
  toDataItemEntry,
  withDataItemReferenceCounts,
} from "./queries";

export async function listDataItemGroups(
  principal: Principal,
  query: DataItemListQuery,
): Promise<AdminDataItemGroups> {
  if (!principal.isPlatformAdmin)
    throw new RequestError("无数据项管理权限", 403);
  const where = dataItemVersionFilter(query);
  return db.$transaction(
    async (tx) => {
      const total = await tx.dataItem.count({
        where: { versions: { some: where } },
      });
      const page = Math.min(
        query.page,
        Math.max(1, Math.ceil(total / query.pageSize)),
      );
      const pageQuery = { ...query, page };
      if (!total) return { groups: [], total, query: pageQuery };

      const orderedGroups = await tx.dataItemVersion.groupBy({
        by: ["dataItemId"],
        where,
        orderBy: [{ _max: { createdAt: "desc" } }, { dataItemId: "desc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      });
      const records = await tx.dataItem.findMany({
        where: {
          id: { in: orderedGroups.map(({ dataItemId }) => dataItemId) },
        },
        select: {
          id: true,
          code: true,
          versions: {
            where: { retiredAt: null },
            orderBy: { version: "desc" },
          },
          _count: {
            select: { versions: { where: { retiredAt: { not: null } } } },
          },
        },
      });
      const historyOnlyIds = records
        .filter(({ versions }) => !versions.length)
        .map(({ id }) => id);
      const historyOnly = historyOnlyIds.length
        ? await tx.dataItem.findMany({
            where: { id: { in: historyOnlyIds } },
            select: {
              code: true,
              versions: {
                where: { retiredAt: { not: null } },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          })
        : [];
      const summaries = new Map<string, AdminDataItemGroup>(
        records.map(({ id, code, _count }) => [
          id,
          {
            id,
            code,
            current: null,
            draft: null,
            latestRetired: null,
            historyCount: _count.versions,
          },
        ]),
      );
      const displayEntries = [...records, ...historyOnly].flatMap(
        ({ code, versions }) =>
          versions.map((version) =>
            toDataItemEntry({ ...version, dataItem: { code } }),
          ),
      );
      for (const entry of await withDataItemReferenceCounts(
        tx,
        displayEntries,
      )) {
        const group = summaries.get(entry.dataItemId)!;
        if (entry.retiredAt) group.latestRetired = entry;
        else if (entry.status === "DRAFT") group.draft ??= entry;
        else group.current ??= entry;
      }
      return {
        groups: orderedGroups.map(({ dataItemId }) =>
          summaries.get(dataItemId)!,
        ),
        total,
        query: pageQuery,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function listDataItemHistory(
  principal: Principal,
  query: DataItemHistoryQuery,
): Promise<AdminDataItemHistory> {
  if (!principal.isPlatformAdmin)
    throw new RequestError("无数据项管理权限", 403);
  const where = { dataItemId: query.dataItemId, retiredAt: { not: null } };
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
        orderBy: { version: "desc" },
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        entries: await withDataItemReferenceCounts(
          tx,
          entries.map(toDataItemEntry),
        ),
        total,
        page,
        pageSize: query.pageSize,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
