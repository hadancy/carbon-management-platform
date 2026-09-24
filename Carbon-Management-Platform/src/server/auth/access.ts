import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { resolveSchoolContext } from "./school-context";

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export type Principal = {
  userId: string;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
};

export async function getPrincipal(
  requestHeaders: Headers,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { platformRoles: true },
  });
  if (!user || user.deletedAt || user.status !== "ACTIVE" || user.banned)
    return null;

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    isPlatformAdmin:
      user.role?.split(",").includes("admin") === true &&
      user.platformRoles.some(
        (role) => role.role === "SUPER_ADMIN" && role.status === "ACTIVE",
      ),
  };
}

export async function requirePrincipal(
  requestHeaders: Headers,
): Promise<Principal> {
  const principal = await getPrincipal(requestHeaders);
  if (!principal) throw new AccessError("请先登录", 401);
  return principal;
}

export async function requirePlatformAdmin(
  requestHeaders: Headers,
): Promise<Principal> {
  const principal = await requirePrincipal(requestHeaders);
  if (!principal.isPlatformAdmin) throw new AccessError("无平台管理权限", 403);
  return principal;
}

export async function listAvailableSchools(userId: string) {
  return db.schoolMembership.findMany({
    where: { userId, status: "ACTIVE", school: { status: "ACTIVE" } },
    include: { school: { select: { id: true, code: true, name: true } } },
    orderBy: { school: { name: "asc" } },
  });
}

export async function getActiveSchoolContext(
  principal: Principal,
  requestedSchoolId?: string,
) {
  const memberships = await listAvailableSchools(principal.userId);
  const selected = memberships.find(
    (membership) => membership.schoolId === requestedSchoolId,
  );
  const membership = selected ?? memberships[0];
  if (!membership) return null;

  const context = resolveSchoolContext({
    authenticatedUserId: principal.userId,
    requestedSchoolId: membership.schoolId,
    membership,
    schoolStatus: "ACTIVE",
  });

  return {
    ...context,
    schoolName: membership.school.name,
    schools: memberships.map((item) => item.school),
  };
}

export async function requireActiveSchoolContext(
  requestHeaders: Headers,
  requestedSchoolId?: string,
) {
  const principal = await requirePrincipal(requestHeaders);
  const context = await getActiveSchoolContext(principal, requestedSchoolId);
  if (!context) throw new AccessError("未分配可用学校", 403);
  return { principal, context };
}
