import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import { audit } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import { upgradeLinkedModels } from "@/server/models/data-item-upgrades";
import {
  createDataItemSchema,
  dataItemFieldsSchema,
  publishDataItemSchema,
  retireDataItemSchema,
  updateDataItemSchema,
} from "@/shared/data-items";
import { toDataItemEntry } from "./queries";
import { deleteUnusedSupersededVersions } from "./deletion";

function requireAdmin(principal: Principal) {
  if (!principal.isPlatformAdmin)
    throw new RequestError("无数据项管理权限", 403);
}

async function getVersion(tx: Prisma.TransactionClient, id: string) {
  const entry = await tx.dataItemVersion.findUnique({
    where: { id },
    include: { dataItem: { select: { code: true } } },
  });
  if (!entry) throw new RequestError("数据项版本不存在", 404);
  return entry;
}

async function retireSupersededVersions(
  tx: Prisma.TransactionClient,
  actorId: string,
  entry: Awaited<ReturnType<typeof getVersion>>,
  publishedAt: Date,
) {
  const reason = `已由 v${entry.version} 接替`;
  const superseded = await tx.dataItemVersion.updateManyAndReturn({
    where: {
      dataItemId: entry.dataItemId,
      version: { lt: entry.version },
      status: "PUBLISHED",
      retiredAt: null,
    },
    data: {
      retiredAt: publishedAt,
      retirementReason: reason,
      revision: { increment: 1 },
    },
    select: { id: true, version: true },
  });
  for (const older of superseded)
    await audit(tx, {
      actorId,
      action: "data-item.retire",
      targetType: "DataItemVersion",
      targetId: older.id,
      details: {
        dataItemId: entry.dataItemId,
        code: entry.dataItem.code,
        version: older.version,
        reason,
        replacedByVersionId: entry.id,
      },
    });
}

export async function createDataItem(principal: Principal, input: unknown) {
  requireAdmin(principal);
  const { code, ...fields } = createDataItemSchema.parse(input);
  try {
    return await db.$transaction(async (tx) => {
      const item = await tx.dataItem.create({ data: { code } });
      const entry = await tx.dataItemVersion.create({
        data: {
          ...fields,
          dataItemId: item.id,
          version: 1,
          createdById: principal.userId,
        },
        include: { dataItem: { select: { code: true } } },
      });
      await audit(tx, {
        actorId: principal.userId,
        action: "data-item.create",
        targetType: "DataItemVersion",
        targetId: entry.id,
        details: { dataItemId: item.id, code, version: 1 },
      });
      return entry;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new RequestError(
        "数据项编码已存在，请搜索已有数据项或更换编码",
        409,
      );
    throw error;
  }
}

async function saveDraft(
  principal: Principal,
  id: string,
  input: unknown,
  publish: boolean,
) {
  requireAdmin(principal);
  const parsed = (
    publish ? publishDataItemSchema : updateDataItemSchema
  ).safeParse(input);
  if (!parsed.success)
    throw new RequestError(
      parsed.error.issues[0]?.message ?? "数据项内容无效",
      400,
    );
  const { revision, ...fields } = parsed.data;
  return db.$transaction(
    async (tx) => {
      const entry = await getVersion(tx, id);
      if (entry.status !== "DRAFT")
        throw new RequestError("已发布数据项内容只读，请创建新版本", 409);
      if (entry.revision !== revision)
        throw new RequestError("数据项已被其他管理员修改，请刷新后重试", 409);
      const publishedAt = publish ? new Date() : null;
      if (publishedAt) {
        await tx.$queryRaw`SELECT "id" FROM "DataItem" WHERE "id" = ${entry.dataItemId}::uuid FOR UPDATE`;
        await retireSupersededVersions(
          tx,
          principal.userId,
          entry,
          publishedAt,
        );
      }
      const result = await tx.dataItemVersion.updateMany({
        where: { id, status: "DRAFT", revision },
        data: {
          ...fields,
          revision: { increment: 1 },
          ...(publishedAt ? { status: "PUBLISHED", publishedAt } : {}),
        },
      });
      if (!result.count)
        throw new RequestError("数据项已被其他管理员修改，请刷新后重试", 409);
      await audit(tx, {
        actorId: principal.userId,
        action: publish ? "data-item.publish" : "data-item.update",
        targetType: "DataItemVersion",
        targetId: id,
        details: {
          dataItemId: entry.dataItemId,
          code: entry.dataItem.code,
          version: entry.version,
        },
      });
      const saved = await getVersion(tx, id);
      if (!publishedAt || entry.version === 1)
        return { entry: saved, modelChanges: [], deletedVersions: [] };
      const modelChanges = await upgradeLinkedModels(
        tx,
        principal.userId,
        toDataItemEntry(saved),
      );
      const deletedVersions = await deleteUnusedSupersededVersions(
        tx,
        principal.userId,
        saved,
      );
      return { entry: saved, modelChanges, deletedVersions };
    },
    publish ? { timeout: 30_000 } : undefined,
  );
}

export async function updateDataItem(
  principal: Principal,
  id: string,
  input: unknown,
) {
  return (await saveDraft(principal, id, input, false)).entry;
}

export function publishDataItem(
  principal: Principal,
  id: string,
  input: unknown,
) {
  return saveDraft(principal, id, input, true);
}

export async function syncPublishedDataItemModels(
  principal: Principal,
  code: string,
) {
  requireAdmin(principal);
  return db.$transaction(
    async (tx) => {
      const [item] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "DataItem" WHERE code = ${code} FOR UPDATE
    `;
      if (!item) throw new RequestError("数据项不存在", 404);
      const [current] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "DataItemVersion"
      WHERE "dataItemId" = ${item.id}::uuid AND status = 'PUBLISHED' AND "retiredAt" IS NULL
      FOR SHARE
    `;
      if (!current) throw new RequestError("该数据项没有可用的发布版本", 409);
      const entry = await getVersion(tx, current.id);
      const modelChanges = await upgradeLinkedModels(
        tx,
        principal.userId,
        toDataItemEntry(entry),
      );
      return { entry, modelChanges };
    },
    { timeout: 30_000 },
  );
}

export async function createNextDataItemVersion(
  principal: Principal,
  sourceVersionId: string,
  input: unknown,
) {
  requireAdmin(principal);
  const fields = dataItemFieldsSchema.parse(input);
  try {
    return await db.$transaction(async (tx) => {
      const source = await getVersion(tx, sourceVersionId);
      const identity = await tx.dataItem.update({
        where: { id: source.dataItemId },
        data: { nextVersion: { increment: 1 } },
        select: { nextVersion: true },
      });
      await getVersion(tx, sourceVersionId);
      if (source.status !== "PUBLISHED")
        throw new RequestError("请直接编辑已有草稿，发布后才可创建新版本", 409);
      const draft = await tx.dataItemVersion.findFirst({
        where: { dataItemId: source.dataItemId, status: "DRAFT" },
        select: { version: true },
      });
      if (draft)
        throw new RequestError(
          `该数据项已有 v${draft.version} 草稿，请搜索该编码并继续编辑`,
          409,
        );
      const entry = await tx.dataItemVersion.create({
        data: {
          ...fields,
          dataItemId: source.dataItemId,
          version: identity.nextVersion - 1,
          createdById: principal.userId,
        },
        include: { dataItem: { select: { code: true } } },
      });
      await audit(tx, {
        actorId: principal.userId,
        action: "data-item.new-version",
        targetType: "DataItemVersion",
        targetId: entry.id,
        details: {
          dataItemId: entry.dataItemId,
          code: source.dataItem.code,
          version: entry.version,
          sourceVersionId,
        },
      });
      return entry;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      throw new RequestError("数据项已删除或状态已变化，请刷新后重试", 409);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new RequestError(
        "该数据项的新版本草稿已创建，请刷新后继续编辑",
        409,
      );
    throw error;
  }
}

export async function retireDataItem(
  principal: Principal,
  id: string,
  input: unknown,
) {
  requireAdmin(principal);
  const { revision, reason } = retireDataItemSchema.parse(input);
  return db.$transaction(async (tx) => {
    const entry = await getVersion(tx, id);
    const result = await tx.dataItemVersion.updateMany({
      where: { id, status: "PUBLISHED", retiredAt: null, revision },
      data: {
        retiredAt: new Date(),
        retirementReason: reason,
        revision: { increment: 1 },
      },
    });
    if (!result.count)
      throw new RequestError(
        "仅可停用未停用的已发布版本；状态已变化时请刷新",
        409,
      );
    await audit(tx, {
      actorId: principal.userId,
      action: "data-item.retire",
      targetType: "DataItemVersion",
      targetId: id,
      details: {
        dataItemId: entry.dataItemId,
        code: entry.dataItem.code,
        version: entry.version,
        reason,
      },
    });
    return getVersion(tx, id);
  });
}
