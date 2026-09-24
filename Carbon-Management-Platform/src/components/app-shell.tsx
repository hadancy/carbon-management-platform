"use client";

import { useRouter } from "next/navigation";
import {
  AppstoreOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Select, Space, Typography } from "antd";
import { authClient } from "@/lib/auth-client";
import type { Principal } from "@/server/auth/access";
import { BackendShell } from "./backend-shell";

const navigation = [
  { href: "/models", label: "碳足迹模型", icon: <AppstoreOutlined /> },
  { href: "/accounting", label: "碳足迹核算", icon: <CalculatorOutlined /> },
  { href: "/reports", label: "碳足迹报告", icon: <FileTextOutlined /> },
];

type SchoolContextView = {
  schoolId: string;
  schoolName: string;
  schools: { id: string; code: string; name: string }[];
};

export function AppShell({
  children,
  principal,
  context,
}: {
  children: React.ReactNode;
  principal: Principal;
  context: SchoolContextView;
}) {
  const router = useRouter();
  const { message } = App.useApp();

  async function switchSchool(schoolId: string) {
    const response = await fetch("/api/schools/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    if (!response.ok) {
      message.error("切换学校失败");
      return;
    }
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <BackendShell
      navigation={navigation}
      extraRoutes={[{ href: "/account", label: "账号设置" }]}
      sectionLabel="业务工作台"
      brandHref="/models"
      displayName={principal.displayName}
      accountHref="/account"
      onSignOut={signOut}
      headerExtras={
        <Space size={8}>
          <Select
            aria-label="当前学校"
            value={context.schoolId}
            onChange={switchSchool}
            options={context.schools.map((school) => ({
              value: school.id,
              label: school.name,
            }))}
            className="w-42 max-sm:w-28"
          />
          {principal.isPlatformAdmin && (
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => router.push("/admin")}
              className="max-sm:px-1.5 max-sm:text-[0px] max-sm:[&_.anticon]:text-base"
            >
              系统管理
            </Button>
          )}
        </Space>
      }
      sidebarFooter={
        <Typography.Text className="text-xs text-[#bfcbd9]">
          当前学校：{context.schoolName}
        </Typography.Text>
      }
    >
      <Alert
        className="mb-5"
        type="warning"
        showIcon
        title="业务模块仍在建设中"
        description="登录和学校权限已接入；模型、核算与报告的数据录入将在后续阶段开放。"
      />
      {children}
    </BackendShell>
  );
}
