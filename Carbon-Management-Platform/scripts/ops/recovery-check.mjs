import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createBackup, restoreNewDatabase } from "./database-backup.mjs";
async function fingerprints(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");
    const { rows: tables } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    const results = [];
    for (const { tablename } of tables) {
      const quoted = '"' + tablename.replaceAll('"', '""') + '"';
      const { rows } = await client.query(
        `SELECT row_to_json(t)::text AS record FROM public.${quoted} t ORDER BY row_to_json(t)::text`,
      );
      results.push({
        table: tablename,
        rows: rows.length,
        sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      });
    }
    return results;
  } finally {
    await client.end();
  }
}
export async function verifyRecovery({ databaseUrl, env }) {
  // This rehearsal only operates on a synthetic integration database.
  const source = new URL(databaseUrl);
  assert.match(source.pathname, /^\/carbon_stage3_[a-f0-9]+$/);
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const restored = new URL(source);
  const name = `carbon_restore_check_${randomBytes(5).toString("hex")}`;
  restored.pathname = "/" + name;
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const temporary = mkdtempSync(join(tmpdir(), "carbon-backup-check-"));
  const archive = join(temporary, "synthetic.dump");
  let created = false;
  const started = performance.now();
  try {
    const before = await fingerprints(databaseUrl);
    assert.ok(
      before.some((table) => table.table === "ReportExport" && table.rows > 0),
      "Restore rehearsal requires an exported report",
    );
    await createBackup(databaseUrl, archive);
    chmodSync(archive, 0o600);
    created = true;
    await restoreNewDatabase(restored.toString(), archive);
    assert.deepEqual(
      await fingerprints(restored.toString()),
      before,
      "Restored rows, evidence bytes, snapshots, sessions and PDF bytes must match",
    );
    const migration = spawnSync(
      "node_modules/.bin/prisma",
      ["migrate", "deploy"],
      {
        env: { ...env, DATABASE_URL: restored.toString() },
        encoding: "utf8",
        timeout: 60000,
      },
    );
    assert.equal(
      migration.status,
      0,
      "Restored database must accept migration deploy",
    );
    const result = {
      status: "PASSED",
      durationMs: Math.round(performance.now() - started),
      archiveBytes: statSync(archive).size,
      tables: before,
      checks: [
        "完整自定义格式备份",
        "独立数据库恢复",
        "全部表行数及 SHA-256 一致（含附件、固定快照、审核、会话与 PDF 字节）",
        "恢复后迁移可重复执行",
      ],
    };
    console.log("Synthetic backup/restore passed");
    return result;
  } finally {
    if (created) {
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
        [name],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    }
    await admin.end();
    rmSync(temporary, { recursive: true, force: true });
  }
}
