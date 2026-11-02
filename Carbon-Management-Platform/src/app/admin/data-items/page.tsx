import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/server/auth/access";
import { listDataItems } from "@/server/data-items/queries";
import { dataItemListQuerySchema } from "@/shared/data-items";
import { DataItemsManager } from "@/components/admin/data-items/data-items-manager";

export default async function DataItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await requirePlatformAdmin(await headers());
  const params = await searchParams;
  const parsed = dataItemListQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    ),
  );
  const query = parsed.success
    ? parsed.data
    : dataItemListQuerySchema.parse({});
  return <DataItemsManager {...await listDataItems(principal, query)} />;
}
