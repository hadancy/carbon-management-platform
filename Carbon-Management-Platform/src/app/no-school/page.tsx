import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Layout, Result } from "antd";
import { getPrincipal } from "@/server/auth/access";
import { SignOutButton } from "@/components/sign-out-button";

export default async function NoSchoolPage() {
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login");

  return (
    <Layout.Content role="main" className="mx-auto my-[10vh] max-w-160 p-6">
      <Result
        status="warning"
        title="尚未分配可用学校"
        subTitle="请联系平台管理员检查学校状态和账号归属。"
        extra={<SignOutButton />}
      />
    </Layout.Content>
  );
}
