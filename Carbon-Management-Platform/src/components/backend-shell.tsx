"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout } from "antd";
import { BackendNavigation } from "./backend/navigation";
import { BackendHeader } from "./backend/header";
import { BackendRouteTabs } from "./backend/route-tabs";

export type BackendNavigationItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type BackendShellProps = {
  children: ReactNode;
  navigation: BackendNavigationItem[];
  extraRoutes?: BackendNavigationItem[];
  sectionLabel: string;
  brandHref: string;
  displayName: string;
  accountHref: string;
  onSignOut: () => Promise<void>;
  headerExtras?: ReactNode;
  sidebarFooter?: ReactNode;
};

export function BackendShell({
  children,
  navigation,
  extraRoutes = [],
  sectionLabel,
  brandHref,
  displayName,
  accountHref,
  onSignOut,
  headerExtras,
  sidebarFooter,
}: BackendShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const routes = [...navigation, ...extraRoutes];
  const active =
    routes.find((item) => pathname === item.href) ??
    routes.find((item) => pathname.startsWith(`${item.href}/`));
  const activeKey = active?.href ?? pathname;
  const tabKeys = visited.includes(activeKey)
    ? visited
    : [...visited, activeKey];

  function remember(target: string) {
    setVisited((current) => [...new Set([...current, activeKey, target])]);
  }

  function closeTab(target: string) {
    const remaining = tabKeys.filter((key) => key !== target);
    setVisited(remaining);
    if (target === activeKey) {
      router.push(remaining.at(-1) ?? navigation[0].href);
    }
  }

  return (
    <Layout className="min-h-screen bg-white" hasSider>
      <BackendNavigation
        navigation={navigation}
        sectionLabel={sectionLabel}
        brandHref={brandHref}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        activeKey={activeKey}
        remember={remember}
        router={router}
        sidebarFooter={sidebarFooter}
      />

      <Layout className="min-w-0 bg-white">
        <BackendHeader
          active={active}
          brandHref={brandHref}
          sectionLabel={sectionLabel}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setDrawerOpen={setDrawerOpen}
          displayName={displayName}
          accountHref={accountHref}
          remember={remember}
          onSignOut={onSignOut}
          router={router}
          headerExtras={headerExtras}
        />
        <BackendRouteTabs
          activeKey={activeKey}
          tabKeys={tabKeys}
          routes={routes}
          closeTab={closeTab}
          router={router}
        />
        <Layout.Content
          role="main"
          className="min-w-0 bg-white px-6 pt-5 pb-10 max-sm:p-4 [&_.ant-card]:rounded-[3px] [&_.ant-card]:shadow-none [&_.ant-table-thead>tr>th]:bg-[#f8f8f9] [&_.ant-table-thead>tr>th]:text-[13px] [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:text-[#515a6e] [&_.ant-table-tbody>tr>td]:text-[#606266] [&_.ant-pagination]:mt-4.5"
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
