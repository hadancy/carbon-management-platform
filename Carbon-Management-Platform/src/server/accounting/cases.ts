import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { requireAccountingPermission } from "./context";
import {
  accountingInputsSchema,
  emptyAccountingInputs,
  type AccountingInputs,
} from "@/shared/accounting";

export async function listCases(schoolId: string) {
  return db.accountingCase.findMany({
    where: { schoolId },
    include: {
      revisions: {
        select: {
          id: true,
          revisionNo: true,
          status: true,
          inputRevision: true,
          updatedAt: true,
        },
        orderBy: { revisionNo: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCase(schoolId: string, id: string) {
  const entry = await db.accountingCase.findFirst({
    where: { id, schoolId },
    include: {
      revisions: {
        include: {
          runs: {
            select: {
              id: true,
              mode: true,
              inputRevision: true,
              inputHash: true,
              engineVersion: true,
              result: true,
              snapshots: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          reviews: true,
          modelVersion: {
            select: {
              id: true,
              version: true,
              content: true,
              model: { select: { code: true, scope: true, schoolId: true } },
            },
          },
        },
        orderBy: { revisionNo: "desc" },
      },
    },
  });
  if (!entry) throw new RequestError("核算案例不存在", 404);
  return entry;
}

async function requirePublishedModel(schoolId: string, id: string) {
  const model = await db.modelVersion.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      model: { scope: "SCHOOL", schoolId, archivedAt: null },
    },
  });
  if (!model) throw new RequestError("仅可选择本校已发布模型版本", 400);
  return model;
}

export async function createCase(
  principal: Principal,
  context: SchoolContext,
  input: { code: string; product: string; modelVersionId: string },
) {
  requireAccountingPermission(context.role, "accounting.write");
  await requirePublishedModel(context.schoolId, input.modelVersionId);
  return db.$transaction(async (tx) => {
    const entry = await tx.accountingCase.create({
      data: {
        schoolId: context.schoolId,
        code: input.code,
        product: input.product,
      },
    });
    const revision = await tx.accountingRevision.create({
      data: {
        caseId: entry.id,
        schoolId: context.schoolId,
        revisionNo: 1,
        modelVersionId: input.modelVersionId,
        scenario: "GRID_ONLY",
        inputs: emptyAccountingInputs() as Prisma.InputJsonValue,
        createdById: principal.userId,
        lastEditedById: principal.userId,
      },
    });
    await tx.accountingCase.update({
      where: { id: entry.id },
      data: { currentRevisionId: revision.id },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "accounting.create",
      targetType: "AccountingCase",
      targetId: entry.id,
    });
    return { ...entry, currentRevisionId: revision.id };
  });
}

export async function saveCaseInputs(
  principal: Principal,
  context: SchoolContext,
  caseId: string,
  expectedInputRevision: number,
  inputs: AccountingInputs,
  ruleVersionId: string | null,
) {
  requireAccountingPermission(context.role, "accounting.write");
  const entry = await getCase(context.schoolId, caseId);
  const current = entry.revisions.find(
    (revision) => revision.id === entry.currentRevisionId,
  );
  if (!current || current.status !== "DRAFT")
    throw new RequestError("当前修订不可编辑，请创建新修订", 409);
  const parsed = accountingInputsSchema.parse(inputs);
  if (ruleVersionId) {
    const rule = await db.publicDataVersion.findFirst({
      where: { id: ruleVersionId, type: "RULE_CONFIG", status: "PUBLISHED" },
    });
    if (!rule) throw new RequestError("仅可选择已发布规则版本", 400);
  }
  const update = await db.accountingRevision.updateMany({
    where: {
      id: current.id,
      schoolId: context.schoolId,
      status: "DRAFT",
      inputRevision: expectedInputRevision,
    },
    data: {
      inputs: parsed as Prisma.InputJsonValue,
      ruleVersionId,
      inputRevision: { increment: 1 },
      lastEditedById: principal.userId,
    },
  });
  if (update.count !== 1)
    throw new RequestError("输入已被更新，请刷新后重试", 409);
  return db.accountingRevision.findUniqueOrThrow({ where: { id: current.id } });
}

export async function createRevision(
  principal: Principal,
  context: SchoolContext,
  caseId: string,
) {
  requireAccountingPermission(context.role, "accounting.write");
  return db.$transaction(async (tx) => {
    const entry = await tx.accountingCase.findFirst({
      where: { id: caseId, schoolId: context.schoolId },
    });
    if (!entry || !entry.currentRevisionId)
      throw new RequestError("核算案例不存在", 404);
    const old = await tx.accountingRevision.findUniqueOrThrow({
      where: { id: entry.currentRevisionId },
    });
    if (old.status !== "REJECTED" && old.status !== "APPROVED")
      throw new RequestError("仅驳回或通过的修订可创建新修订", 409);
    const revision = await tx.accountingRevision.create({
      data: {
        caseId,
        schoolId: context.schoolId,
        revisionNo: old.revisionNo + 1,
        modelVersionId: old.modelVersionId,
        ruleVersionId: old.ruleVersionId,
        scenario: old.scenario,
        inputs: old.inputs as Prisma.InputJsonValue,
        createdById: principal.userId,
        lastEditedById: principal.userId,
      },
    });
    const moved = await tx.accountingCase.updateMany({
      where: { id: caseId, currentRevisionId: old.id },
      data: { currentRevisionId: revision.id },
    });
    if (moved.count !== 1)
      throw new RequestError("案例已被更新，请刷新后重试", 409);
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "accounting.revise",
      targetType: "AccountingRevision",
      targetId: revision.id,
    });
    return revision;
  });
}
