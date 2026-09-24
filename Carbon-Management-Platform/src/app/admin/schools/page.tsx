import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { SchoolAccountsWorkspace } from "@/components/admin/school-accounts-workspace";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    schoolId?: string;
    createAdmin?: string;
  }>;
}) {
  await requirePlatformAdmin(await headers());
  const [schools, users, params] = await Promise.all([
    db.school.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true } } },
    }),
    db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        platformRoles: { select: { role: true } },
        memberships: { include: { school: { select: { name: true } } } },
      },
    }),
    searchParams,
  ]);

  return (
    <SchoolAccountsWorkspace
      view={params.view === "accounts" ? "accounts" : "schools"}
      schoolId={params.schoolId}
      createAdmin={params.createAdmin === "1"}
      schools={schools.map((school) => ({
        id: school.id,
        code: school.code,
        name: school.name,
        status: school.status,
        memberCount: school._count.memberships,
        createdAt: school.createdAt.toISOString(),
      }))}
      users={users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        isPlatformAdmin:
          (user.role?.split(",").includes("admin") ?? false) ||
          user.platformRoles.some((role) => role.role === "SUPER_ADMIN"),
        memberships: user.memberships.map((membership) => ({
          schoolId: membership.schoolId,
          schoolName: membership.school.name,
          role: membership.role,
          status: membership.status,
        })),
      }))}
    />
  );
}
