"use client";

import { useRouter } from "next/navigation";
import {
  BankOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { authClient } from "@/lib/auth-client";
import { BackendShell } from "@/components/backend-shell";

const navigation = [
  { href: "/admin/schools", label: "学校与账号", icon: <BankOutlined /> },
  { href: "/admin/public-data", label: "公共数据", icon: <DatabaseOutlined /> },
  { href: "/admin/audit", label: "审计日志", icon: <FileSearchOutlined /> },
];

export function AdminShell({
  children,
  displayName,
  hasSchool,
}: {
  children: React.ReactNode;
  displayName: string;
  hasSchool: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <BackendShell
      navigation={navigation}
      extraRoutes={[{ href: "/admin/account", label: "账号设置" }]}
      sectionLabel="系统管理"
      brandHref="/admin"
      displayName={displayName}
      accountHref="/admin/account"
      onSignOut={signOut}
      headerExtras={
        hasSchool ? (
          <Button
            type="text"
            icon={<SwapOutlined />}
            onClick={() => router.push("/models")}
          >
            学校工作台
          </Button>
        ) : undefined
      }
    >
      {children}
    </BackendShell>
  );
}
