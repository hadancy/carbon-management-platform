import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/server/db/prisma";
import { audit } from "../../src/server/admin/audit";
import { createSchool } from "../../src/server/admin/schools";
import {
  createPublicDataDraft,
  publishPublicData,
} from "../../src/server/admin/public-data";
import {
  createModel,
  transitionModelVersion,
} from "../../src/server/models/service";
import { uploadAsset } from "../../src/server/files/service";
import type { Principal } from "../../src/server/auth/access";
import type { SchoolRole } from "../../src/shared/permissions";
import { ensureDemoModelCatalog } from "./pv-catalog";
import {
  demoAccounts,
  demoEvidenceFile,
  demoInputs,
  demoPassword,
  loadDemoReference,
} from "./pv-data";

async function ensureSchool(actor: Principal, code: string, name: string) {
  const existing = await db.school.findUnique({ where: { code } });
  if (existing) {
    if (existing.name !== name || existing.status !== "ACTIVE")
      throw new Error(`演示学校编码冲突或已停用：${code}`);
    return existing;
  }
  return createSchool(actor, { code, name });
}

async function ensureAccount(
  actor: Principal,
  account: { email: string; name: string },
  schoolId: string,
  role: SchoolRole,
) {
  let user = await db.user.findUnique({ where: { email: account.email } });
  if (!user) {
    const password = await hashPassword(demoPassword);
    const userId = randomUUID();
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          email: account.email,
          displayName: account.name,
          emailVerified: true,
          role: "user",
          accounts: {
            create: {
              id: randomUUID(),
              accountId: userId,
              providerId: "credential",
              password,
            },
          },
        },
      });
      await audit(tx, {
        actorId: actor.userId,
        schoolId,
        action: "demo.account.create",
        targetType: "User",
        targetId: created.id,
        details: { email: account.email, role },
      });
      return created;
    });
  }
  if (
    user.displayName !== account.name ||
    user.status !== "ACTIVE" ||
    user.deletedAt ||
    user.banned ||
    user.role !== "user"
  )
    throw new Error(`演示账号冲突或不可用：${account.email}`);
  const membership = await db.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId: user.id } },
  });
  if (membership) {
    if (membership.role !== role || membership.status !== "ACTIVE")
      throw new Error(`演示成员归属已变化：${account.email}`);
  } else {
    await db.$transaction(async (tx) => {
      await tx.schoolMembership.create({
        data: { schoolId, userId: user.id, role },
      });
      await audit(tx, {
        actorId: actor.userId,
        schoolId,
        action: "demo.membership.create",
        targetType: "User",
        targetId: user.id,
        details: { role },
      });
    });
  }
  return {
    principal: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      isPlatformAdmin: false,
    },
    context: { userId: user.id, schoolId, role },
  };
}

export async function setupPvDemo() {
  if (demoPassword.length < 12)
    throw new Error("PV_DEMO_PASSWORD 须至少 12 位");
  const administrator = await db.user.findFirst({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      banned: false,
      platformRoles: { some: { role: "SUPER_ADMIN", status: "ACTIVE" } },
    },
  });
  if (!administrator) throw new Error("请先初始化本地平台管理员");
  const actor: Principal = {
    userId: administrator.id,
    email: administrator.email,
    displayName: administrator.displayName,
    isPlatformAdmin: true,
  };
  const schoolA = await ensureSchool(actor, "DEMO_PV_A", "光伏流程演示学校 A");
  const schoolB = await ensureSchool(actor, "DEMO_PV_B", "光伏流程演示学校 B");
  const writer = await ensureAccount(
    actor,
    demoAccounts.writer,
    schoolA.id,
    "SCHOOL_ADMIN",
  );
  const reviewer = await ensureAccount(
    actor,
    demoAccounts.reviewer,
    schoolA.id,
    "REVIEWER",
  );
  const outsider = await ensureAccount(
    actor,
    demoAccounts.outsider,
    schoolB.id,
    "SCHOOL_ADMIN",
  );
  const reference = await loadDemoReference();
  const factorIds: string[] = [];
  for (const factor of reference.snapshot.factors) {
    const code = `DEMO_${factor.code}`;
    let entry = await db.publicDataVersion.findUnique({
      where: {
        type_code_version: { type: "EMISSION_FACTOR", code, version: "1" },
      },
    });
    if (!entry)
      entry = await createPublicDataDraft(actor, {
        type: "EMISSION_FACTOR",
        code,
        version: "1",
        title: `DEMO 流程演示 ${factor.content.applicability.stage}`,
        source: `DEMO 构造案例；因子参考 ${factor.content.evidence.reference}`,
        content: {
          ...factor.content,
          purpose: "PRODUCTION",
          note: "DEMO：PRODUCTION 仅用于验证提交审核分支；本版本为流程演示配置",
        },
      });
    if (entry.status === "DRAFT")
      entry = await publishPublicData(actor, entry.id);
    if (entry.retiredAt) throw new Error(`演示因子已停用：${code}`);
    factorIds.push(entry.id);
  }
  let rule = await db.publicDataVersion.findUnique({
    where: {
      type_code_version: {
        type: "RULE_CONFIG",
        code: "DEMO_PV_RULE",
        version: "1",
      },
    },
  });
  if (!rule)
    rule = await createPublicDataDraft(actor, {
      type: "RULE_CONFIG",
      code: "DEMO_PV_RULE",
      version: "1",
      title: "DEMO 并网光伏流程规则",
      source: "DEMO 流程验收；方法参考 GB/T 47652—2026",
      content: {
        ...reference.snapshot.ruleVersion.content,
        purpose: "PRODUCTION",
        approvalReference: "DEMO：流程分支测试，构造案例",
      },
    });
  if (rule.status === "DRAFT") rule = await publishPublicData(actor, rule.id);
  let model = await db.footprintModel.findFirst({
    where: {
      scope: "SCHOOL",
      schoolId: schoolA.id,
      code: "DEMO_PV_MODEL",
      archivedAt: null,
    },
    include: { versions: { orderBy: { version: "asc" } } },
  });
  if (!model) {
    const content = await ensureDemoModelCatalog(
      actor,
      reference.snapshot.modelVersion.content,
    );
    model = await createModel(writer.principal, writer.context, {
      code: "DEMO_PV_MODEL",
      scope: "SCHOOL",
      content: {
        ...content,
        name: "DEMO 并网光伏流程模型",
      },
    });
  }
  const version = model.versions[0];
  if (version.status === "DRAFT")
    await transitionModelVersion(writer.principal, writer.context, version.id, {
      action: "submit",
    });
  if (version.status === "DRAFT" || version.status === "SUBMITTED")
    await transitionModelVersion(
      reviewer.principal,
      reviewer.context,
      version.id,
      { action: "publish" },
    );
  if (version.status === "REJECTED")
    throw new Error("演示模型已被驳回，请先处理模型审核");
  const file = demoEvidenceFile();
  const asset =
    (await db.fileAsset.findFirst({
      where: {
        schoolId: schoolA.id,
        uploadedById: writer.principal.userId,
        name: file.name,
      },
    })) ?? (await uploadAsset(writer.principal, writer.context, file));
  return {
    actor,
    schoolA,
    schoolB,
    writer,
    reviewer,
    outsider,
    reference,
    modelVersionId: version.id,
    ruleVersionId: rule.id,
    inputs: demoInputs(reference, factorIds, asset.id),
    asset,
  };
}
