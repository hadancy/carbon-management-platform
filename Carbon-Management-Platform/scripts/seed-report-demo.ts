import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { db } from "../src/server/db/prisma";
import { setupPvDemo } from "./demo/pv-setup";
import { runReportDemo } from "./demo/report-workflow";

async function main() {
  const { values } = parseArgs({
    options: {
      code: { type: "string", default: "DEMO_REPORT_T07" },
      case: { type: "string", default: "DEMO_PV_001" },
      date: {
        type: "string",
        default: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/New_York",
        }).format(new Date()),
      },
      output: { type: "string" },
      pdf: { type: "string" },
    },
  });
  const database = new URL(process.env.DATABASE_URL!);
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  )
    throw new Error("报告演示仅支持本机开发或临时测试数据库");
  if (
    !/^DEMO_[A-Z0-9_-]{1,74}$/.test(values.code!) ||
    !/^DEMO_[A-Z0-9_-]{1,74}$/.test(values.case!)
  )
    throw new Error("报告与案例编号须以 DEMO_ 开头");
  z.iso.date().parse(values.date);
  const demo = await setupPvDemo();
  const { result, pdf } = await runReportDemo(
    demo,
    values.code!,
    values.case!,
    values.date!,
  );
  if (values.pdf) await writeFile(values.pdf, pdf, { flag: "wx" });
  if (values.output)
    await writeFile(values.output, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
