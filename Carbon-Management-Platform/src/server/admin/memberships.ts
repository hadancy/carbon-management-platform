import "server-only";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import type { Principal } from "@/server/auth/access";
import type { SchoolRole } from "@/shared/permissions";
import { audit } from "./audit";

export async function setMembership(
  principal: Principal,
  input: {
    userId: string;
    schoolId: string;
    role: SchoolRole;
    status: "ACTIVE" | "INACTIVE";
  },
) {
  const [school, user] = await Promise.all([
    db.school.findUnique({ where: { id: input.schoolId } }),
    db.user.findUnique({ where: { id: input.userId } }),
  ]);
  if (!school || !user || user.deletedAt)
    throw new RequestError("学校或账号不存在", 404);

  return db.$transaction(async (tx) => {
    const existing = await tx.schoolMembership.findUnique({
      where: {
        schoolId_userId: { schoolId: input.schoolId, userId: input.userId },
      },
    });
    if (!existing && school.status !== "ACTIVE")
      throw new RequestError("学校已停用，无法添加账号", 400);
    const membership = await tx.schoolMembership.upsert({
      where: {
        schoolId_userId: { schoolId: input.schoolId, userId: input.userId },
      },
      create: input,
      update: { role: input.role, status: input.status },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: input.schoolId,
      action: "membership.upsert",
      targetType: "SchoolMembership",
      targetId: input.userId,
      details: { role: input.role, status: input.status },
    });
    return membership;
  });
}

export async function removeMembership(
  principal: Principal,
  userId: string,
  schoolId: string,
) {
  return db.$transaction(async (tx) => {
    const membership = await tx.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });
    if (!membership) throw new RequestError("学校归属不存在", 404);
    await tx.schoolMembership.delete({
      where: { schoolId_userId: { schoolId, userId } },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId,
      action: "membership.remove",
      targetType: "SchoolMembership",
      targetId: userId,
    });
  });
}
