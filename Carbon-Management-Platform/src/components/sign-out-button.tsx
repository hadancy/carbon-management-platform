"use client";

import { Button } from "antd";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      退出登录
    </Button>
  );
}
