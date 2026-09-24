import type { useRouter } from "next/navigation";
import { Tabs } from "antd";
import type { BackendNavigationItem } from "../backend-shell";

type Props = {
  activeKey: string;
  tabKeys: string[];
  routes: BackendNavigationItem[];
  closeTab: (target: string) => void;
  router: ReturnType<typeof useRouter>;
};

export function BackendRouteTabs({
  activeKey,
  tabKeys,
  routes,
  closeTab,
  router,
}: Props) {
  return (
    <Tabs
      className="m-0 h-8.75 border-b border-[#d8dce5] bg-white px-3 pt-0.75 shadow-[0_1px_3px_rgb(0_0_0/9%)] [&_.ant-tabs-nav]:m-0 [&_.ant-tabs-nav]:h-7.75 [&_.ant-tabs-nav:before]:hidden [&_.ant-tabs-tab]:mr-1.25 [&_.ant-tabs-tab]:ml-0 [&_.ant-tabs-tab]:h-6.5 [&_.ant-tabs-tab]:rounded-xs [&_.ant-tabs-tab]:border [&_.ant-tabs-tab]:border-[#d8dce5] [&_.ant-tabs-tab]:bg-white [&_.ant-tabs-tab]:px-2 [&_.ant-tabs-tab]:py-0 [&_.ant-tabs-tab]:text-xs [&_.ant-tabs-tab-active]:border-[#409eff] [&_.ant-tabs-tab-active]:bg-[#409eff] [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white [&_.ant-tabs-tab-active_.ant-tabs-tab-remove]:text-white [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:mr-1.25 [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:inline-block [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:h-1.75 [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:w-1.75 [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:rounded-full [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:bg-white [&_.ant-tabs-tab-active_.ant-tabs-tab-btn:before]:content-['']"
      type="editable-card"
      hideAdd
      size="small"
      activeKey={activeKey}
      items={tabKeys.map((key) => ({
        key,
        label: routes.find((item) => item.href === key)?.label ?? "当前页面",
        closable: tabKeys.length > 1,
      }))}
      onChange={(key) => router.push(key)}
      onEdit={(targetKey, action) => {
        if (action === "remove" && typeof targetKey === "string") {
          closeTab(targetKey);
        }
      }}
    />
  );
}
