import "server-only";
import { cookies } from "next/headers";
import { requireActiveSchoolContext } from "@/server/auth/access";
import { RequestError } from "@/server/http/response";
import { canSchool, type SchoolAction } from "@/shared/permissions";

export async function accountingContext(headers: Headers) {
  const selectedSchoolId = (await cookies()).get("active_school")?.value;
  return requireActiveSchoolContext(headers, selectedSchoolId);
}

export function requireAccountingPermission(
  role: string,
  action: SchoolAction,
) {
  if (!canSchool(role, action)) throw new RequestError("无此核算操作权限", 403);
}
