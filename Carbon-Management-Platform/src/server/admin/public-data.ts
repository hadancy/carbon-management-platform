import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import type { Principal } from "@/server/auth/access";
import { audit } from "./audit";

export async function createPublicDataDraft(
  principal: Principal,
  input: {
    type: "EMISSION_FACTOR" | "RULE_CONFIG" | "REPORT_TEMPLATE";
    code: string;
    version: string;
    title: string;
    source?: string;
    content: Prisma.InputJsonValue;
  },
) {
  return db.$transaction(async (tx) => {
    const entry = await tx.publicDataVersion.create({
      data: { ...input, createdById: principal.userId },
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "public-data.create",
      targetType: "PublicDataVersion",
      targetId: entry.id,
      details: { type: entry.type, code: entry.code, version: entry.version },
    });
    return entry;
  });
}

export async function updatePublicDataDraft(
  principal: Principal,
  id: string,
  input: { title: string; source?: string; content: Prisma.InputJsonValue },
) {
  return db.$transaction(async (tx) => {
    const entry = await tx.publicDataVersion.findUnique({ where: { id } });
    if (!entry) throw new RequestError("公共数据版本不存在", 404);
    if (entry.status !== "DRAFT")
      throw new RequestError("已发布版本不可修改", 409);
    const updated = await tx.publicDataVersion.update({
      where: { id, status: "DRAFT" },
      data: input,
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "public-data.update",
      targetType: "PublicDataVersion",
      targetId: id,
      details: { type: entry.type, code: entry.code, version: entry.version },
    });
    return updated;
  });
}

export async function publishPublicData(principal: Principal, id: string) {
  return db.$transaction(async (tx) => {
    const entry = await tx.publicDataVersion.findUnique({ where: { id } });
    if (!entry) throw new RequestError("公共数据版本不存在", 404);
    if (entry.status !== "DRAFT") throw new RequestError("该版本已经发布", 409);
    if (entry.type !== "REPORT_TEMPLATE" && !entry.source?.trim()) {
      throw new RequestError("排放因子和规则配置必须填写来源", 400);
    }
    const updated = await tx.publicDataVersion.update({
      where: { id, status: "DRAFT" },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "public-data.publish",
      targetType: "PublicDataVersion",
      targetId: id,
      details: { type: entry.type, code: entry.code, version: entry.version },
    });
    return updated;
  });
}
