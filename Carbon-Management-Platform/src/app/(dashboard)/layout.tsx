import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getActiveSchoolContext, getPrincipal } from "@/server/auth/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login");

  const selectedSchoolId = (await cookies()).get("active_school")?.value;
  const context = await getActiveSchoolContext(principal, selectedSchoolId);
  if (!context) redirect(principal.isPlatformAdmin ? "/admin" : "/no-school");

  return (
    <AppShell principal={principal} context={context}>
      {children}
    </AppShell>
  );
}
