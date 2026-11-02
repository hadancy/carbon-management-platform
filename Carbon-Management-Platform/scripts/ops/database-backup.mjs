import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  linkSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { postgresCommand } from "./postgres-tools.mjs";
async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function createBackup(databaseUrl, path) {
  assert.ok(databaseUrl, "DATABASE_URL is required");
  path = resolve(path);
  assert.ok(
    !existsSync(path) && !existsSync(path + ".json"),
    "Backup and manifest paths must be new",
  );
  const temporary = path + "." + randomBytes(5).toString("hex") + ".partial";
  writeFileSync(temporary, "", { flag: "wx", mode: 0o600 });
  try {
    postgresCommand(
      process.env.PG_DUMP_BIN ?? "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", temporary],
      databaseUrl,
    );
    const result = {
      format: "postgres-custom",
      createdAt: new Date().toISOString(),
      bytes: statSync(temporary).size,
      sha256: await fileHash(temporary),
    };
    // link is atomic and refuses to replace a file created by another process.
    linkSync(temporary, path);
    writeFileSync(path + ".json", JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return result;
  } finally {
    unlinkSync(temporary);
  }
}
export async function restoreNewDatabase(databaseUrl, path) {
  assert.ok(databaseUrl, "RESTORE_DATABASE_URL is required");
  path = resolve(path);
  const manifest = JSON.parse(readFileSync(path + ".json", "utf8"));
  assert.equal(manifest.format, "postgres-custom");
  assert.equal(statSync(path).size, manifest.bytes);
  assert.equal(
    await fileHash(path),
    manifest.sha256,
    "Backup SHA-256 mismatch",
  );
  const url = new URL(databaseUrl),
    name = decodeURIComponent(url.pathname.slice(1));
  assert.match(
    name,
    /^carbon_restore_[a-z0-9_]+$/,
    "Restore only accepts a new database named carbon_restore_...",
  );
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    assert.equal(
      (await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
        .rowCount,
      0,
      "Restore target already exists",
    );
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  postgresCommand(
    process.env.PG_RESTORE_BIN ?? "pg_restore",
    [
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      name,
      path,
    ],
    databaseUrl,
  );
  return { database: name, sha256: manifest.sha256 };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [action, path] = process.argv.slice(2);
    assert.ok(
      path,
      "Provide the archive path in an existing private directory",
    );
    if (action === "backup")
      console.log(
        JSON.stringify(await createBackup(process.env.DATABASE_URL, path)),
      );
    else if (action === "restore")
      console.log(
        JSON.stringify(
          await restoreNewDatabase(process.env.RESTORE_DATABASE_URL, path),
        ),
      );
    else throw Error("Use backup or restore followed by the archive path");
  } catch (error) {
    console.error(
      "Database backup/restore failed: " +
        (error instanceof Error ? error.message : "unknown error"),
    );
    process.exitCode = 1;
  }
}
