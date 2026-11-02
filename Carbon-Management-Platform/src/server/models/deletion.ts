import "server-only";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { audit } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import { canSchool } from "@/shared/permissions";

export async function deleteDraftModelVersion(
  principal: Principal,
  context: SchoolContext | null,
  id: string,
) {
  const entry = await db.modelVersion.findUnique({
    where: { id },
    include: { model: true },
  });
  if (
    !entry ||
    entry.model.archivedAt ||
    (entry.model.scope === "SCHOOL" &&
      entry.model.schoolId !== context?.schoolId)
  )
    throw new RequestError("模型版本不存在", 404);
  if (entry.model.scope === "PUBLIC") {
    if (!principal.isPlatformAdmin)
      throw new RequestError("无公用模型管理权限", 403);
  } else if (!context || !canSchool(context.role, "model.write")) {
    throw new RequestError("无本校模型编辑权限", 403);
  }
  if (entry.status !== "DRAFT" && entry.status !== "REJECTED")
    throw new RequestError("只能删除草稿或被驳回的版本", 409);

  return db.$transaction(async (tx) => {
    const newerCount = await tx.modelVersion.count({
      where: { modelId: entry.modelId, version: { gt: entry.version } },
    });
    if (newerCount) throw new RequestError("只能删除最新版本", 409);
    const result = await tx.modelVersion.deleteMany({
      where: {
        id,
        modelId: entry.modelId,
        status: { in: ["DRAFT", "REJECTED"] },
        model: { archivedAt: null },
      },
    });
    if (!result.count)
      throw new RequestError("模型状态已变化，请刷新页面", 409);

    const remaining = await tx.modelVersion.count({
      where: { modelId: entry.modelId },
    });
    if (!remaining) {
      await tx.footprintModel.update({
        where: { id: entry.modelId },
        data: { archivedAt: new Date() },
      });
    }
    await audit(tx, {
      actorId: principal.userId,
      schoolId: entry.model.schoolId ?? undefined,
      action: "model.version.delete",
      targetType: "ModelVersion",
      targetId: id,
      details: {
        code: entry.model.code,
        version: entry.version,
        modelArchived: remaining === 0,
      },
    });
    return { deleted: true, modelArchived: remaining === 0 };
  });
}

export async function archiveModel(
  principal: Principal,
  context: SchoolContext | null,
  id: string,
) {
  const model = await db.footprintModel.findUnique({
    where: { id },
    include: { versions: { select: { status: true } } },
  });
  if (
    !model ||
    model.archivedAt ||
    (model.scope === "SCHOOL" && model.schoolId !== context?.schoolId)
  )
    throw new RequestError("模型不存在", 404);
  if (model.scope === "PUBLIC") {
    if (!principal.isPlatformAdmin)
      throw new RequestError("无公用模型管理权限", 403);
  } else if (!context || !canSchool(context.role, "model.publish")) {
    throw new RequestError("已发布模型需要校内发布权限才能删除", 403);
  }
  if (model.versions.some((version) => version.status !== "PUBLISHED"))
    throw new RequestError("请先处理未发布版本，再归档整个模型", 409);
  return db.$transaction(async (tx) => {
    const result = await tx.footprintModel.updateMany({
      where: {
        id,
        archivedAt: null,
        versions: { every: { status: "PUBLISHED" } },
      },
      data: { archivedAt: new Date() },
    });
    if (!result.count)
      throw new RequestError("模型状态已变化，请刷新页面", 409);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: model.schoolId ?? undefined,
      action: "model.archive",
      targetType: "FootprintModel",
      targetId: id,
      details: { code: model.code, scope: model.scope },
    });
    return { archived: true };
  });
}
