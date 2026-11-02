import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { db } from "@/server/db/client";
import { PublicDataManager } from "@/components/admin/public-data-manager";

export default async function PublicDataPage() {
  await requirePlatformAdmin(await headers());
  const entries = await db.publicDataVersion.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <PublicDataManager
      entries={entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        code: entry.code,
        version: entry.version,
        title: entry.title,
        source: entry.source,
        status: entry.status,
        content: JSON.stringify(entry.content, null, 2),
        publishedAt: entry.publishedAt?.toISOString() ?? null,
        retiredAt: entry.retiredAt?.toISOString() ?? null,
      }))}
    />
  );
}
