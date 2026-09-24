export const SCHOOL_ROLES = [
  "SCHOOL_ADMIN",
  "MODEL_EDITOR",
  "ACCOUNTANT",
  "REVIEWER",
  "VIEWER",
] as const;

export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export const SCHOOL_ROLE_LABELS: Record<SchoolRole, string> = {
  SCHOOL_ADMIN: "学校管理员",
  MODEL_EDITOR: "模型维护者",
  ACCOUNTANT: "核算员",
  REVIEWER: "审核员",
  VIEWER: "只读用户",
};

export type SchoolAction =
  | "model.write"
  | "model.publish"
  | "accounting.write"
  | "accounting.review"
  | "report.write"
  | "report.review"
  | "report.export";

const permissions: Record<SchoolRole, ReadonlySet<SchoolAction>> = {
  SCHOOL_ADMIN: new Set([
    "model.write",
    "model.publish",
    "accounting.write",
    "accounting.review",
    "report.write",
    "report.review",
    "report.export",
  ]),
  MODEL_EDITOR: new Set(["model.write"]),
  ACCOUNTANT: new Set(["accounting.write", "report.write", "report.export"]),
  REVIEWER: new Set(["model.publish", "accounting.review", "report.review"]),
  VIEWER: new Set(),
};

export function isSchoolRole(value: string): value is SchoolRole {
  return SCHOOL_ROLES.some((role) => role === value);
}

export function canSchool(role: string, action: SchoolAction): boolean {
  return isSchoolRole(role) && permissions[role].has(action);
}
