import type { ReactNode } from "react";
import Link from "next/link";
import type { useRouter } from "next/navigation";
import {
  CaretDownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Breadcrumb,
  Button,
  Dropdown,
  Flex,
  Layout,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import type { BackendNavigationItem } from "../backend-shell";

type Props = {
  active: BackendNavigationItem | undefined;
  brandHref: string;
  sectionLabel: string;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  setDrawerOpen: (value: boolean) => void;
  displayName: string;
  accountHref: string;
  remember: (target: string) => void;
  onSignOut: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
  headerExtras?: ReactNode;
};

export function BackendHeader({
  active,
  brandHref,
  sectionLabel,
  collapsed,
  setCollapsed,
  setDrawerOpen,
  displayName,
  accountHref,
  remember,
  onSignOut,
  router,
  headerExtras,
}: Props) {
  const accountItems: MenuProps["items"] = [
    { key: "account", label: "账号设置" },
    { type: "divider" },
    { key: "logout", label: "退出登录" },
  ];

  return (
    <Layout.Header className="z-1 flex h-12.5 items-center justify-between gap-3 bg-white pr-4.5 pl-2 leading-normal shadow-[0_1px_4px_rgb(0_21_41/8%)] max-sm:pr-2 [&_.ant-breadcrumb]:overflow-hidden [&_.ant-breadcrumb]:text-ellipsis [&_.ant-breadcrumb]:whitespace-nowrap">
      <Flex align="center" gap={14} className="min-w-0">
        <Button
          type="text"
          className="h-12 w-10.5 rounded-none text-lg text-[#5a5e66] max-[900px]:hidden"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          onClick={() => setCollapsed(!collapsed)}
        />
        <Button
          type="text"
          className="hidden h-12 w-10.5 rounded-none text-lg text-[#5a5e66] max-[900px]:inline-flex"
          icon={<MenuUnfoldOutlined />}
          aria-label="打开导航"
          onClick={() => setDrawerOpen(true)}
        />
        <Breadcrumb
          items={[
            { title: <Link href={brandHref}>首页</Link> },
            { title: sectionLabel },
            { title: active?.label ?? "当前页面" },
          ]}
        />
      </Flex>
      <Flex align="center" gap={12} className="min-w-0">
        {headerExtras}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: accountItems,
            onClick: ({ key }) => {
              if (key === "account") {
                remember(accountHref);
                router.push(accountHref);
              } else if (key === "logout") {
                void onSignOut();
              }
            },
          }}
        >
          <Button
            type="text"
            className="flex h-11.5 items-center gap-2 px-1.5 text-[#5a5e66]"
          >
            <Avatar
              size={25}
              className="bg-[#e9eff5] font-semibold text-[#304156]"
            >
              {displayName.slice(0, 1)}
            </Avatar>
            <Typography.Text className="text-[13px] text-[#5a5e66] max-sm:hidden">
              {displayName}
            </Typography.Text>
            <CaretDownOutlined className="text-[10px] max-sm:hidden" />
          </Button>
        </Dropdown>
      </Flex>
    </Layout.Header>
  );
}
