import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getPrincipal, listAvailableSchools } from "@/server/auth/access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login");
  if (!principal.isPlatformAdmin) notFound();
  const schools = await listAvailableSchools(principal.userId);

  return (
    <AdminShell
      displayName={principal.displayName}
      hasSchool={schools.length > 0}
    >
      {children}
    </AdminShell>
  );
}
