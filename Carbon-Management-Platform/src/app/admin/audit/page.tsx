import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { AuditTable } from "@/components/admin/audit-table";

export default async function AuditPage() {
  await requirePlatformAdmin(await headers());
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { email: true } },
      school: { select: { name: true } },
    },
  });

  return (
    <AuditTable
      logs={logs.map((log) => ({
        id: log.id,
        time: log.createdAt.toISOString(),
        actor: log.actor.email,
        school: log.school?.name ?? "平台",
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
      }))}
    />
  );
}
