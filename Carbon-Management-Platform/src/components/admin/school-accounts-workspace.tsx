"use client";

import { useRouter } from "next/navigation";
import { Tabs } from "antd";
import { SchoolsManager } from "./schools-manager";
import { UsersManager } from "./users-manager";
import type { SchoolRow } from "./schools/types";
import type { UserRow } from "./users/types";

export function SchoolAccountsWorkspace({
  view,
  schoolId,
  createAdmin,
  schools,
  users,
}: {
  view: "schools" | "accounts";
  schoolId?: string;
  createAdmin: boolean;
  schools: SchoolRow[];
  users: UserRow[];
}) {
  const router = useRouter();
  const selectedSchool = schools.find((school) => school.id === schoolId);

  return (
    <>
      <Tabs
        activeKey={view}
        onChange={(key) =>
          router.push(
            key === "accounts"
              ? "/admin/schools?view=accounts"
              : "/admin/schools",
          )
        }
        items={[
          { key: "schools", label: "按学校" },
          { key: "accounts", label: "全部账号" },
        ]}
        className="mb-4"
      />
      {view === "accounts" ? (
        <UsersManager
          users={users}
          schools={schools.map(({ id, name, status }) => ({
            id,
            name,
            status,
          }))}
        />
      ) : selectedSchool ? (
        <UsersManager
          key={selectedSchool.id}
          users={users}
          schools={schools.map(({ id, name, status }) => ({
            id,
            name,
            status,
          }))}
          schoolContext={selectedSchool}
          startCreate={createAdmin}
          onBack={() => router.push("/admin/schools")}
        />
      ) : (
        <SchoolsManager
          schools={schools}
          onManageAccounts={(school) =>
            router.push(`/admin/schools?schoolId=${school.id}`)
          }
          onCreated={(id) =>
            router.push(`/admin/schools?schoolId=${id}&createAdmin=1`)
          }
        />
      )}
    </>
  );
}
