import "server-only";
import { pvRuleSchema } from "@/shared/calculation-rule";
import { publicReportTemplateSchema } from "@/shared/report-template";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import type { Principal } from "@/server/auth/access";
import {
  calculationFactorSchema,
  emissionFactorDraftSchema,
} from "@/shared/emission-factors";
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
  if (input.type === "EMISSION_FACTOR")
    emissionFactorDraftSchema.parse(input.content);
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
    if (entry.type === "EMISSION_FACTOR")
      emissionFactorDraftSchema.parse(input.content);
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
    if (entry.type === "EMISSION_FACTOR") {
      const factor = calculationFactorSchema.safeParse(entry.content);
      if (!factor.success)
        throw new RequestError(
          `发布计算因子前须补齐 v2 数值、适用范围和证据：${factor.error.issues[0]?.path.join(".") ?? "content"} ${factor.error.issues[0]?.message ?? "内容无效"}`,
          400,
        );
    }
    if (entry.type === "RULE_CONFIG") {
      const rule = pvRuleSchema.safeParse(entry.content);
      if (!rule.success)
        throw new RequestError(
          `发布规则前须补齐用途、方法、适用期及确认依据：${rule.error.issues[0]?.message ?? "规则内容无效"}`,
          400,
        );
    }
    if (entry.type === "REPORT_TEMPLATE") {
      const template = publicReportTemplateSchema.safeParse(entry.content);
      if (!template.success)
        throw new RequestError(
          `发布报告模板前须补齐版式、用途与确认依据：${template.error.issues[0]?.message ?? "模板内容无效"}`,
          400,
        );
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

export async function retireEmissionFactor(
  principal: Principal,
  id: string,
  reason: string,
) {
  if (!reason.trim()) throw new RequestError("请填写因子停用原因", 400);
  return db.$transaction(async (tx) => {
    const result = await tx.publicDataVersion.updateMany({
      where: {
        id,
        type: "EMISSION_FACTOR",
        status: "PUBLISHED",
        retiredAt: null,
      },
      data: { retiredAt: new Date(), retirementReason: reason.trim() },
    });
    if (!result.count) throw new RequestError("因子不存在或已停用", 409);
    await audit(tx, {
      actorId: principal.userId,
      action: "public-data.retire",
      targetType: "PublicDataVersion",
      targetId: id,
      details: { reason: reason.trim() },
    });
    return tx.publicDataVersion.findUniqueOrThrow({ where: { id } });
  });
}
