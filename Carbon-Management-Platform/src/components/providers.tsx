"use client";

import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#409eff",
          colorInfo: "#409eff",
          colorSuccess: "#67c23a",
          colorWarning: "#e6a23c",
          colorError: "#f56c6c",
          colorText: "#303133",
          colorTextSecondary: "#606266",
          colorBorder: "#dcdfe6",
          colorBgLayout: "#fff",
          borderRadius: 4,
          controlHeight: 32,
          fontSize: 14,
          fontFamily:
            '"Helvetica Neue", Helvetica, "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
        },
      }}
    >
      <App component={false}>{children}</App>
    </ConfigProvider>
  );
}
