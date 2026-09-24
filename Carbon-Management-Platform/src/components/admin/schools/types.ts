export type SchoolRow = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  memberCount: number;
  createdAt: string;
};
export type SchoolForm = { code: string; name: string };
