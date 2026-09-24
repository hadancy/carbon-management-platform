import "server-only";
import { db } from "@/server/db/client";
import type { Principal } from "@/server/auth/access";
import { audit } from "./audit";

export async function createSchool(
  principal: Principal,
  input: { code: string; name: string },
) {
  return db.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { code: input.code, name: input.name },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: school.id,
      action: "school.create",
      targetType: "School",
      targetId: school.id,
      details: { code: school.code, name: school.name },
    });
    return school;
  });
}

export async function setSchoolStatus(
  principal: Principal,
  schoolId: string,
  status: "ACTIVE" | "INACTIVE",
) {
  return db.$transaction(async (tx) => {
    const school = await tx.school.update({
      where: { id: schoolId },
      data: { status },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId,
      action: "school.status",
      targetType: "School",
      targetId: schoolId,
      details: { status },
    });
    return school;
  });
}

export async function updateSchool(
  principal: Principal,
  schoolId: string,
  name: string,
) {
  return db.$transaction(async (tx) => {
    const school = await tx.school.update({
      where: { id: schoolId },
      data: { name },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId,
      action: "school.update",
      targetType: "School",
      targetId: schoolId,
      details: { name },
    });
    return school;
  });
}
