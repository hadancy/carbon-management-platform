import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "碳管理平台",
  description: "学校碳足迹模型、核算与报告管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white font-sans text-[#303133]">
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
