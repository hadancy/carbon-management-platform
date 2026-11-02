import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { pvAcceptanceSchema } from "../src/domain/acceptance/pv-contract";
import {
  acceptanceHash,
  verifyPvAcceptance,
} from "../src/domain/acceptance/pv";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string" },
      "require-business": { type: "boolean", default: false },
    },
  });
  if (positionals.length > 1)
    throw new Error(
      "用法：npm run verify:pv -- [验收包.json] [--output 结果.json] [--require-business]",
    );
  const bundlePath = resolve(
    positionals[0] ?? "tests/fixtures/pv-acceptance-reference.json",
  );
  const raw: unknown = JSON.parse(await readFile(bundlePath, "utf8"));
  const parsed = pvAcceptanceSchema.safeParse(raw);
  const verified = new Set<string>();
  const evidenceErrors: string[] = [];
  if (parsed.success)
    for (const item of parsed.data.evidence) {
      try {
        const bytes = await readFile(resolve(dirname(bundlePath), item.path));
        if (createHash("sha256").update(bytes).digest("hex") === item.sha256) {
          const assets = parsed.data.snapshot.assets.filter(
            (asset) => asset.contentHash === item.sha256,
          );
          if (assets.some((asset) => asset.size !== bytes.length))
            evidenceErrors.push(`运行附件大小不符：${item.id}`);
          else verified.add(item.id);
        } else evidenceErrors.push(`证据摘要不符：${item.id}`);
      } catch {
        evidenceErrors.push(`无法读取证据：${item.id}`);
      }
    }
  const result = verifyPvAcceptance(raw, verified);
  const sourceFiles = [
    "src/domain/calculation/decimal.ts",
    "src/domain/calculation/units.ts",
    "src/domain/calculation/energy.ts",
    "src/domain/calculation/factor-selection.ts",
    "src/domain/calculation/pv-contract.ts",
    "src/domain/calculation/pv-lines.ts",
    "src/domain/calculation/pv.ts",
    "src/shared/models.ts",
    "src/shared/units.ts",
    "src/shared/calculation-profile.ts",
    "src/shared/emission-factors.ts",
    "src/shared/accounting.ts",
    "src/shared/calculation-rule.ts",
    "src/domain/acceptance/pv-contract.ts",
    "src/domain/acceptance/pv-comparison.ts",
    "src/domain/acceptance/pv-readiness.ts",
    "src/domain/acceptance/pv.ts",
    "package-lock.json",
  ];
  const sources = await Promise.all(
    sourceFiles.map(async (path) => ({
      path,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    caseId: parsed.success ? parsed.data.caseId : null,
    caseKind: parsed.success ? parsed.data.caseKind : null,
    bundleHash: acceptanceHash(raw),
    ...result,
    evidenceErrors,
    verifiedEvidenceIds: [...verified],
    sources,
    note: "此结果证明数值复算和已声明资料的完整性；业务签认真实性由验收负责人核对。源码摘要不替代历史可执行构建产物的部署归档。",
  };
  if (values.output) {
    const output = resolve(values.output);
    const evidencePaths = parsed.success
      ? parsed.data.evidence.map((item) =>
          resolve(dirname(bundlePath), item.path),
        )
      : [];
    if (
      output === bundlePath ||
      evidencePaths.includes(output) ||
      sources.some((item) => output === resolve(item.path))
    )
      throw new Error("结果路径不能覆盖验收包、来源凭证或引擎文件");
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
  }
  console.log(JSON.stringify(report, null, 2));
  if (
    !result.numericalPassed ||
    evidenceErrors.length ||
    (values["require-business"] && result.status !== "READY_FOR_REVIEW")
  )
    process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
