import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { db } from "../src/server/db/prisma";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const email = argument("--email")?.trim().toLowerCase();
const name = argument("--name")?.trim() || "平台管理员";

async function main() {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(
      "用法：npm run bootstrap:admin -- --email admin@example.com [--name 姓名]",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const command = resolve(process.cwd(), "node_modules/.bin/auth");
    const result = spawnSync(
      command,
      [
        "create-admin",
        "--config",
        "src/lib/auth.ts",
        "--email",
        email,
        "--name",
        name,
      ],
      { stdio: "inherit", env: process.env },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    if (!user.role?.split(",").includes("admin"))
      throw new Error("认证管理员角色未创建");
    await db.platformRole.upsert({
      where: { userId_role: { userId: user.id, role: "SUPER_ADMIN" } },
      create: { userId: user.id, role: "SUPER_ADMIN" },
      update: { status: "ACTIVE" },
    });
    console.log("平台管理员已创建，可登录系统管理入口。");
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("平台管理员初始化失败", error);
  process.exitCode = 1;
});
