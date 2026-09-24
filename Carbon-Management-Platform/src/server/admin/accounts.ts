import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import type { Principal } from "@/server/auth/access";
import type { SchoolRole } from "@/shared/permissions";
import { audit } from "./audit";

export async function createAccount(
  principal: Principal,
  requestHeaders: Headers,
  input: {
    email: string;
    displayName: string;
    password: string;
    schoolId: string;
    role: SchoolRole;
  },
) {
  const school = await db.school.findUnique({ where: { id: input.schoolId } });
  if (!school || school.status !== "ACTIVE")
    throw new RequestError("学校不存在或已停用", 400);
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new RequestError("账号已存在；请为现有账号分配学校", 409);
  }

  await auth.api.createUser({
    body: {
      name: input.displayName,
      email: input.email,
      password: input.password,
    },
    headers: requestHeaders,
  });

  const user = await db.user.findUniqueOrThrow({
    where: { email: input.email },
  });
  await db.$transaction(async (tx) => {
    await tx.schoolMembership.create({
      data: { userId: user.id, schoolId: input.schoolId, role: input.role },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: input.schoolId,
      action: "account.create",
      targetType: "User",
      targetId: user.id,
      details: { email: user.email, role: input.role },
    });
  });
  return user;
}

export async function setAccountStatus(
  principal: Principal,
  requestHeaders: Headers,
  userId: string,
  status: "ACTIVE" | "INACTIVE",
) {
  if (userId === principal.userId)
    throw new RequestError("不能停用当前登录账号", 400);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new RequestError("账号不存在", 404);
  if (user.role?.split(",").includes("admin")) {
    throw new RequestError("不能在此修改平台管理员账号", 403);
  }

  if (status === "INACTIVE") {
    await auth.api.banUser({
      body: { userId, banReason: "Account disabled by platform administrator" },
      headers: requestHeaders,
    });
  } else {
    await auth.api.unbanUser({ body: { userId }, headers: requestHeaders });
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status },
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "account.status",
      targetType: "User",
      targetId: userId,
      details: { status },
    });
    return updated;
  });
}

export async function updateAccount(
  principal: Principal,
  userId: string,
  displayName: string,
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new RequestError("账号不存在", 404);
    if (user.role?.split(",").includes("admin")) {
      throw new RequestError("不能在此修改平台管理员账号", 403);
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { displayName },
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "account.update",
      targetType: "User",
      targetId: userId,
      details: { displayName },
    });
    return updated;
  });
}

export async function resetAccountPassword(
  principal: Principal,
  requestHeaders: Headers,
  userId: string,
  newPassword: string,
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new RequestError("账号不存在", 404);
  if (user.role?.split(",").includes("admin")) {
    throw new RequestError("不能在此重置平台管理员密码", 403);
  }

  await auth.api.setUserPassword({
    body: { userId, newPassword },
    headers: requestHeaders,
  });
  await auth.api.revokeUserSessions({
    body: { userId },
    headers: requestHeaders,
  });
  await db.auditLog.create({
    data: {
      actorId: principal.userId,
      action: "account.password-reset",
      targetType: "User",
      targetId: userId,
    },
  });
}

export async function deleteAccount(principal: Principal, userId: string) {
  if (userId === principal.userId)
    throw new RequestError("不能删除当前登录账号", 403);

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { platformRoles: true },
    });
    if (!user || user.deletedAt) throw new RequestError("账号不存在", 404);
    if (
      user.role?.split(",").includes("admin") ||
      user.platformRoles.some((role) => role.role === "SUPER_ADMIN")
    ) {
      throw new RequestError("平台管理员账号不能删除", 403);
    }

    const schoolIds = (
      await tx.schoolMembership.findMany({
        where: { userId },
        select: { schoolId: true },
      })
    ).map((membership) => membership.schoolId);

    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.schoolMembership.deleteMany({ where: { userId } });
    await tx.platformRole.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({ where: { identifier: user.email } });
    await tx.auditLog.updateMany({
      where: { targetType: "User", targetId: userId },
      data: { details: { deletedAccount: true } },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@invalid.local`,
        displayName: "已删除账号",
        emailVerified: false,
        image: null,
        role: null,
        status: "INACTIVE",
        banned: true,
        banReason: "Account deleted",
        banExpires: null,
        deletedAt: new Date(),
      },
    });
    await audit(tx, {
      actorId: principal.userId,
      action: "account.delete",
      targetType: "User",
      targetId: userId,
      details: { schoolIds },
    });
  });
}
