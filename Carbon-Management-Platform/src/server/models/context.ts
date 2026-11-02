import "server-only";
import { cookies } from "next/headers";
import { getActiveSchoolContext, requirePrincipal } from "@/server/auth/access";

export async function getModelRequestContext(headers: Headers) {
  const principal = await requirePrincipal(headers);
  const selectedSchoolId = (await cookies()).get("active_school")?.value;
  const context = await getActiveSchoolContext(principal, selectedSchoolId);
  return { principal, context };
}
