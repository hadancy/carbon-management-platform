import "server-only";
import { Prisma, type ModelScope } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { canSchool } from "@/shared/permissions";
import { resolveModelDataItems } from "./data-items";
import { recordModelDataItemUsage } from "@/server/data-items/usage";
import { createModelDraft, lockModelVersionWrites } from "./draft-versions";
import {
  findNewerModelDataItems,
  prepareSchoolTemplateCopy,
  upgradeModelDataItems,
  upgradeModelVersionDataItems,
} from "./data-item-upgrades";
import {
  emptyModelContent,
  modelContentSchema,
  normalizeLegacyModelContent,
  validatePublishableModel,
  type ModelContent,
} from "@/shared/models";

export async function listSchoolModels(schoolId: string) {
  const [schoolModels, publicModels] = await Promise.all([
    db.footprintModel.findMany({
      where: { scope: "SCHOOL", schoolId, archivedAt: null },
      include: {
        sourceVersion: {
          select: { version: true, model: { select: { code: true } } },
        },
        versions: { orderBy: { version: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.footprintModel.findMany({
      where: {
        scope: "PUBLIC",
        archivedAt: null,
        versions: { some: { status: "PUBLISHED" } },
      },
      include: {
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: { version: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { schoolModels, publicModels };
}

export async function listPublicModels() {
  return db.footprintModel.findMany({
    where: { scope: "PUBLIC", archivedAt: null },
    include: { versions: { orderBy: { version: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}

function requireScopeWrite(
  scope: ModelScope,
  schoolId: string | null,
  principal: Principal,
  context: SchoolContext | null,
) {
  if (scope === "PUBLIC") {
    if (!principal.isPlatformAdmin)
      throw new RequestError("无公用模型管理权限", 403);
  } else if (
    !context ||
    context.schoolId !== schoolId ||
    !canSchool(context.role, "model.write")
  ) {
    throw new RequestError("无本校模型编辑权限", 403);
  }
}

async function requireVersionAccess(
  id: string,
  principal: Principal,
  context: SchoolContext | null,
) {
  const entry = await db.modelVersion.findUnique({
    where: { id },
    include: { model: true },
  });
  if (!entry || entry.model.archivedAt)
    throw new RequestError("模型版本不存在", 404);
  if (entry.model.scope === "PUBLIC") {
    if (!principal.isPlatformAdmin)
      throw new RequestError("模型版本不存在", 404);
  } else if (!context || entry.model.schoolId !== context.schoolId) {
    throw new RequestError("模型版本不存在", 404);
  }
  return entry;
}

export async function createModel(
  principal: Principal,
  context: SchoolContext | null,
  input: {
    code: string;
    scope: ModelScope;
    sourceVersionId?: string;
    content?: ModelContent;
  },
) {
  requireScopeWrite(
    input.scope,
    input.scope === "SCHOOL" ? (context?.schoolId ?? null) : null,
    principal,
    context,
  );
  if (input.scope === "PUBLIC" && input.sourceVersionId)
    throw new RequestError("公用模型不能引用学校模板", 400);
  let content = input.content ?? emptyModelContent();
  if (input.sourceVersionId) {
    const source = await db.modelVersion.findUnique({
      where: { id: input.sourceVersionId },
      include: { model: true },
    });
    if (
      !source ||
      source.model.archivedAt ||
      source.model.scope !== "PUBLIC" ||
      source.status !== "PUBLISHED"
    )
      throw new RequestError("仅可引用已发布的公用模型版本", 400);
    content = modelContentSchema.parse(source.content);
  }
  try {
    return await db.$transaction(async (tx) => {
      const draftContent = input.sourceVersionId
        ? await prepareSchoolTemplateCopy(tx, content)
        : content;
      const resolvedContent = await resolveModelDataItems(
        tx,
        draftContent,
        input.sourceVersionId ? content : undefined,
      );
      const model = await tx.footprintModel.create({
        data: {
          scope: input.scope,
          schoolId: input.scope === "SCHOOL" ? context!.schoolId : null,
          code: input.code,
          sourceVersionId: input.sourceVersionId,
          versions: {
            create: {
              version: 1,
              content: resolvedContent as Prisma.InputJsonValue,
              createdById: principal.userId,
              lastEditedById: principal.userId,
            },
          },
        },
        include: { versions: true },
      });
      await recordModelDataItemUsage(tx, model.versions[0].id, resolvedContent);
      await audit(tx, {
        actorId: principal.userId,
        schoolId: model.schoolId ?? undefined,
        action: "model.create",
        targetType: "FootprintModel",
        targetId: model.id,
        details: {
          scope: model.scope,
          code: model.code,
          sourceVersionId: input.sourceVersionId ?? null,
        },
      });
      return model;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new RequestError(
        input.scope === "PUBLIC"
          ? "公用模板编码已存在，请更换编码"
          : "本校模型编码已存在，请更换编码",
        409,
      );
    }
    throw error;
  }
}

export async function saveModelVersion(
  principal: Principal,
  context: SchoolContext | null,
  id: string,
  content: ModelContent,
  expectedUpdatedAt?: string,
) {
  const entry = await requireVersionAccess(id, principal, context);
  requireScopeWrite(
    entry.model.scope,
    entry.model.schoolId,
    principal,
    context,
  );
  if (entry.status !== "DRAFT" && entry.status !== "REJECTED")
    throw new RequestError("只有草稿或被驳回的版本可以编辑", 409);
  requireCurrentVersion(entry.updatedAt, expectedUpdatedAt);
  return db.$transaction(async (tx) => {
    const resolvedContent = await resolveModelDataItems(
      tx,
      content,
      modelContentSchema.parse(entry.content),
    );
    await lockModelVersionWrites(tx, entry.modelId);
    const result = await tx.modelVersion.updateMany({
      where: {
        id,
        updatedAt: entry.updatedAt,
        status: { in: ["DRAFT", "REJECTED"] },
        model: { archivedAt: null },
      },
      data: {
        content: resolvedContent as Prisma.InputJsonValue,
        status: "DRAFT",
        reviewNote: null,
        reviewedById: null,
        lastEditedById: principal.userId,
      },
    });
    if (!result.count)
      throw new RequestError("模型状态已变化，请刷新页面", 409);
    await recordModelDataItemUsage(tx, id, resolvedContent);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: entry.model.schoolId ?? undefined,
      action: "model.save",
      targetType: "ModelVersion",
      targetId: id,
    });
    return tx.modelVersion.findUniqueOrThrow({ where: { id } });
  });
}

function requireCurrentVersion(updatedAt: Date, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt && updatedAt.toISOString() !== expectedUpdatedAt)
    throw new RequestError("模型已更新，请刷新页面并核对最新内容", 409);
}

export async function transitionModelVersion(
  principal: Principal,
  context: SchoolContext | null,
  id: string,
  input: {
    action: "submit" | "publish" | "reject";
    note?: string;
    expectedUpdatedAt?: string;
  },
) {
  const entry = await requireVersionAccess(id, principal, context);
  const isPublic = entry.model.scope === "PUBLIC";
  if (input.action === "submit") {
    if (isPublic) throw new RequestError("公用模型由平台管理员直接发布", 400);
    requireScopeWrite(
      entry.model.scope,
      entry.model.schoolId,
      principal,
      context,
    );
    if (entry.status !== "DRAFT" && entry.status !== "REJECTED")
      throw new RequestError("当前模型不能提交审核", 409);
  } else if (isPublic) {
    if (!principal.isPlatformAdmin || input.action !== "publish")
      throw new RequestError("无公用模型发布权限", 403);
    if (entry.status !== "DRAFT")
      throw new RequestError("当前模型不能发布", 409);
  } else {
    if (!context || !canSchool(context.role, "model.publish"))
      throw new RequestError("无本校模型审核权限", 403);
    if (
      entry.createdById === principal.userId ||
      entry.lastEditedById === principal.userId ||
      entry.submittedById === principal.userId
    )
      throw new RequestError("不能审核自己创建的模型版本", 403);
    if (entry.status !== "SUBMITTED")
      throw new RequestError("只有待审核版本可以审核", 409);
  }
  if (input.action === "reject" && !input.note?.trim())
    throw new RequestError("请填写驳回原因", 400);
  requireCurrentVersion(entry.updatedAt, input.expectedUpdatedAt);
  const normalizedContent =
    input.action === "reject"
      ? null
      : normalizeLegacyModelContent(modelContentSchema.parse(entry.content))
          .content;
  if (normalizedContent) {
    const problem = validatePublishableModel(normalizedContent);
    if (problem) throw new RequestError(problem, 400);
  }
  return db.$transaction(async (tx) => {
    await lockModelVersionWrites(tx, entry.modelId);
    if ((isPublic || input.action === "submit") && normalizedContent) {
      const newer = await findNewerModelDataItems(tx, normalizedContent);
      const first = newer.values().next().value;
      if (first)
        throw new RequestError(
          `数据项「${first.code}」已有 v${first.version}，请核对并更换后${isPublic ? "发布模板" : "提交审核"}`,
          409,
        );
    }
    const result = await tx.modelVersion.updateMany({
      where: {
        id,
        status: entry.status,
        updatedAt: entry.updatedAt,
        model: { archivedAt: null },
      },
      data:
        input.action === "submit"
          ? {
              status: "SUBMITTED",
              content: normalizedContent as Prisma.InputJsonValue,
              submittedAt: new Date(),
              submittedById: principal.userId,
              reviewNote: null,
            }
          : input.action === "publish"
            ? {
                status: "PUBLISHED",
                content: normalizedContent as Prisma.InputJsonValue,
                publishedAt: new Date(),
                reviewedById: principal.userId,
                reviewNote: null,
              }
            : {
                status: "REJECTED",
                reviewedById: principal.userId,
                reviewNote: input.note!.trim(),
              },
    });
    if (!result.count)
      throw new RequestError("模型状态已变化，请刷新页面", 409);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: entry.model.schoolId ?? undefined,
      action: `model.${input.action}`,
      targetType: "ModelVersion",
      targetId: id,
      details: {
        code: entry.model.code,
        version: entry.version,
        note: input.note ?? null,
      },
    });
    const version = await tx.modelVersion.findUniqueOrThrow({ where: { id } });
    if (entry.status !== "SUBMITTED") return version;
    const replacements = await findNewerModelDataItems(
      tx,
      modelContentSchema.parse(version.content),
    );
    if (!replacements.size) return version;
    const change = await upgradeModelVersionDataItems(tx, {
      model: entry.model,
      version,
      replacements,
      actorId: principal.userId,
    });
    return version.status === "REJECTED" && change?.updated
      ? tx.modelVersion.findUniqueOrThrow({ where: { id } })
      : version;
  });
}

export async function createNextModelVersion(
  principal: Principal,
  context: SchoolContext | null,
  modelId: string,
) {
  const model = await db.footprintModel.findUnique({ where: { id: modelId } });
  if (
    !model ||
    model.archivedAt ||
    (model.scope === "SCHOOL" && model.schoolId !== context?.schoolId)
  )
    throw new RequestError("模型不存在", 404);
  requireScopeWrite(model.scope, model.schoolId, principal, context);
  return db.$transaction(async (tx) => {
    await lockModelVersionWrites(tx, modelId);
    const latest = await tx.modelVersion.findFirst({
      where: { modelId, model: { archivedAt: null } },
      orderBy: { version: "desc" },
    });
    if (!latest || latest.status !== "PUBLISHED")
      throw new RequestError("请先完成当前版本的发布", 409);
    let content = latest.content as Prisma.InputJsonValue;
    const previous = modelContentSchema.parse(latest.content);
    const replacements = await findNewerModelDataItems(tx, previous);
    if (replacements.size)
      content = upgradeModelDataItems(previous, replacements, "new-draft")
        .content as Prisma.InputJsonValue;
    return createModelDraft(tx, {
      model,
      actorId: principal.userId,
      version: latest.version + 1,
      content,
    });
  });
}
