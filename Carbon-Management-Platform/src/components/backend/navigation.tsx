import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar, Drawer, Flex, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import type { useRouter } from "next/navigation";
import type { BackendNavigationItem } from "../backend-shell";
import { requestNavigation } from "./navigation-guard";

type Props = {
  navigation: BackendNavigationItem[];
  sectionLabel: string;
  brandHref: string;
  collapsed: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  activeKey: string;
  remember: (target: string) => void;
  router: ReturnType<typeof useRouter>;
  sidebarFooter?: ReactNode;
};

export function BackendNavigation({
  navigation,
  sectionLabel,
  brandHref,
  collapsed,
  drawerOpen,
  setDrawerOpen,
  activeKey,
  remember,
  router,
  sidebarFooter,
}: Props) {
  const menuItems: MenuProps["items"] = navigation.map((item) => ({
    key: item.href,
    icon: item.icon,
    label: item.label,
  }));

  const navigationMenu = (mobile: boolean) => (
    <Menu
      theme="dark"
      mode="inline"
      inlineCollapsed={!mobile && collapsed}
      selectedKeys={
        navigation.some((item) => item.href === activeKey) ? [activeKey] : []
      }
      items={menuItems}
      className="flex-1 border-0 bg-[#304156] text-sm [&_.ant-menu-item]:m-0 [&_.ant-menu-item]:w-full [&_.ant-menu-item]:rounded-none [&_.ant-menu-item-selected]:bg-[#1f2d3d] [&_.ant-menu-item-selected]:text-[#409eff]"
      aria-label={sectionLabel}
      onClick={({ key }) => {
        if (key === activeKey) return;
        requestNavigation(() => {
          remember(key);
          setDrawerOpen(false);
          router.push(key);
        });
      }}
    />
  );

  return (
    <>
      <Layout.Sider
        className="z-2 bg-[#304156] shadow-[2px_0_6px_rgb(0_21_41/18%)] max-[900px]:hidden"
        width={200}
        collapsedWidth={56}
        collapsed={collapsed}
        trigger={null}
      >
        <Flex vertical className="sticky top-0 h-screen">
          <Link
            href={brandHref}
            className="flex min-h-12.5 items-center gap-2.25 overflow-hidden whitespace-nowrap px-3.25"
            aria-label="碳管理平台首页"
          >
            <Avatar
              shape="square"
              size={30}
              className="shrink-0 bg-[#3b7c75] text-base font-bold text-white"
            >
              C
            </Avatar>
            {!collapsed && (
              <Typography.Text className="text-[15px] font-semibold text-white">
                碳管理平台
              </Typography.Text>
            )}
          </Link>
          {!collapsed && (
            <Typography.Text className="block px-5 pt-4 pb-2 text-xs text-[#92a6bb]">
              {sectionLabel}
            </Typography.Text>
          )}
          {navigationMenu(false)}
          {!collapsed && sidebarFooter && (
            <Flex className="border-t border-white/10 px-4 py-3.5 [&_.ant-btn-link]:p-0 [&_.ant-btn-link]:text-[#bfcbd9]">
              {sidebarFooter}
            </Flex>
          )}
        </Flex>
      </Layout.Sider>
      <Drawer
        placement="left"
        size={230}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="碳管理平台"
        className="[&_.ant-drawer-body]:bg-[#304156] [&_.ant-drawer-body]:p-0 [&_.ant-drawer-header]:min-h-12.5 [&_.ant-drawer-header]:border-0 [&_.ant-drawer-header]:bg-[#304156] [&_.ant-drawer-title]:text-white [&_.ant-drawer-close]:text-white"
      >
        <Typography.Text className="block px-5 pt-4 pb-2 text-xs text-[#92a6bb]">
          {sectionLabel}
        </Typography.Text>
        {navigationMenu(true)}
        {sidebarFooter}
      </Drawer>
    </>
  );
}
