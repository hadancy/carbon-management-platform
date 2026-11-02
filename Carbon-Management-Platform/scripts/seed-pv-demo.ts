import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { db } from "../src/server/db/prisma";
import { setupPvDemo } from "./demo/pv-setup";
import { runPvDemo } from "./demo/pv-workflow";

async function main() {
  const { values } = parseArgs({
    options: {
      code: { type: "string", default: "DEMO_PV_001" },
      output: { type: "string" },
    },
  });
  const database = new URL(process.env.DATABASE_URL!);
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  )
    throw new Error("演示初始化仅支持本机开发或临时测试数据库");
  if (!/^DEMO_[A-Z0-9_-]{1,74}$/.test(values.code!))
    throw new Error(
      "案例编码须以 DEMO_ 开头，仅含大写字母、数字、下划线或连字符",
    );
  const demo = await setupPvDemo();
  const report = await runPvDemo(demo, values.code!);
  if (values.output)
    await writeFile(values.output, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
