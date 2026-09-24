export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
  isPlatformAdmin: boolean;
  createdAt: string;
  memberships: {
    schoolId: string;
    schoolName: string;
    role: string;
    status: "ACTIVE" | "INACTIVE";
  }[];
};

export type SchoolOption = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};
export type Dialog = "create" | "edit" | "membership" | "password" | null;
export type AccountForm = {
  email: string;
  displayName: string;
  password: string;
  schoolId: string;
  role: string;
};
export type MembershipForm = {
  schoolId: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
};
