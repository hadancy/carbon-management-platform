import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import pg from "pg";

const localEnv = parse(readFileSync(new URL("../.env", import.meta.url)));
const sourceUrl = new URL(localEnv.DATABASE_URL);
const databaseName = `carbon_stage3_${randomBytes(5).toString("hex")}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const port = 31000 + Math.floor(Math.random() * 1000);
const baseURL = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  NODE_ENV: "production",
};
const password = `Test-${randomBytes(16).toString("hex")}`;
const newPassword = `Reset-${randomBytes(16).toString("hex")}`;
const adminEmail = `stage3-admin-${randomUUID()}@example.test`;
const schoolEmail = `stage3-school-${randomUUID()}@example.test`;
const viewerEmail = `stage3-viewer-${randomUUID()}@example.test`;
const pgAdmin = new pg.Client({ connectionString: adminUrl.toString() });
let server;
let databaseCreated = false;
let serverLogs = "";
let adminId;

function command(binary, args) {
  const result = spawnSync(binary, args, { env, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${binary} failed: ${result.stdout}\n${result.stderr}`);
  }
}

async function api(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      origin: baseURL,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function signIn(email, candidatePassword = password) {
  const options = {
    method: "POST",
    body: { email, password: candidatePassword },
  };
  let result = await api("/api/auth/sign-in/email", options);
  if (result.response.status === 429) {
    const retryAfter = Number(
      result.response.headers.get("retry-after") ?? "10",
    );
    await delay((Number.isFinite(retryAfter) ? retryAfter : 10) * 1000 + 200);
    result = await api("/api/auth/sign-in/email", options);
  }
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const cookie = result.response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.match(cookie, /better-auth\.session_token=/);
  return cookie;
}

async function expectStatus(path, status, options) {
  const result = await api(path, options);
  assert.equal(
    result.response.status,
    status,
    `${path}: ${JSON.stringify(result.data)}`,
  );
  return result.data;
}

try {
  await pgAdmin.connect();
  await pgAdmin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  command("node_modules/.bin/prisma", ["migrate", "deploy"]);
  command("node_modules/.bin/auth", [
    "create-admin",
    "--config",
    "src/lib/auth.ts",
    "--email",
    adminEmail,
    "--password",
    password,
    "--name",
    "Test Admin",
    "--yes",
  ]);

  const testDb = new pg.Client({ connectionString: testUrl.toString() });
  await testDb.connect();
  try {
    const { rows } = await testDb.query(
      'SELECT id FROM "User" WHERE email = $1',
      [adminEmail],
    );
    assert.equal(rows.length, 1);
    adminId = rows[0].id;
    await testDb.query(
      'INSERT INTO "PlatformRole" ("userId", role, status) VALUES ($1, $2, $3)',
      [rows[0].id, "SUPER_ADMIN", "ACTIVE"],
    );
  } finally {
    await testDb.end();
  }

  server = spawn("node_modules/.bin/next", ["start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      serverLogs = (serverLogs + chunk.toString()).slice(-12000);
    });
  }
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${baseURL}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert.ok(ready, "Application did not start");

  await expectStatus("/api/admin/schools", 401, {
    method: "POST",
    body: { code: "A", name: "School A" },
  });
  const adminCookie = await signIn(adminEmail);
  await expectStatus("/admin/account", 200, { cookie: adminCookie });
  const schoolA = await expectStatus("/api/admin/schools", 201, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SMOKE_A", name: "Test School A" },
  });
  const schoolB = await expectStatus("/api/admin/schools", 201, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SMOKE_B", name: "Test School B" },
  });
  await expectStatus(`/admin/schools?schoolId=${schoolA.school.id}`, 200, {
    cookie: adminCookie,
  });
  await expectStatus("/admin/schools?view=accounts", 200, {
    cookie: adminCookie,
  });
  const renamedSchool = await expectStatus(
    `/api/admin/schools/${schoolA.school.id}`,
    200,
    {
      method: "PATCH",
      cookie: adminCookie,
      body: { name: "Updated School A" },
    },
  );
  assert.equal(renamedSchool.school.name, "Updated School A");
  const schoolAccount = await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: schoolEmail,
      displayName: "Test School User",
      password,
      schoolId: schoolA.school.id,
      role: "SCHOOL_ADMIN",
    },
  });
  const renamedAccount = await expectStatus(
    `/api/admin/users/${schoolAccount.user.id}`,
    200,
    {
      method: "PATCH",
      cookie: adminCookie,
      body: { displayName: "Updated School User" },
    },
  );
  assert.equal(renamedAccount.user.displayName, "Updated School User");
  const viewerAccount = await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: viewerEmail,
      displayName: "Test Viewer",
      password,
      schoolId: schoolB.school.id,
      role: "VIEWER",
    },
  });
  const schoolCookie = await signIn(schoolEmail);
  const viewerCookie = await signIn(viewerEmail);
  await expectStatus(`/api/admin/users/${adminId}`, 403, {
    method: "DELETE",
    cookie: adminCookie,
  });
  await expectStatus(`/api/admin/users/${viewerAccount.user.id}`, 403, {
    method: "DELETE",
    cookie: viewerCookie,
  });
  await expectStatus("/api/admin/memberships", 200, {
    method: "POST",
    cookie: adminCookie,
    body: {
      userId: viewerAccount.user.id,
      schoolId: schoolA.school.id,
      role: "VIEWER",
      status: "ACTIVE",
    },
  });
  await expectStatus("/api/admin/memberships", 200, {
    method: "DELETE",
    cookie: adminCookie,
    body: { userId: viewerAccount.user.id, schoolId: schoolA.school.id },
  });
  await expectStatus("/api/admin/schools", 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "DENIED", name: "Denied School" },
  });
  await expectStatus("/api/schools/active", 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { schoolId: schoolB.school.id },
  });
  await expectStatus("/api/schools/active", 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { schoolId: schoolA.school.id },
  });
  await expectStatus("/api/schools/active", 403, {
    method: "POST",
    cookie: viewerCookie,
    body: { schoolId: schoolA.school.id },
  });
  await expectStatus("/api/admin/public-data", 403, {
    method: "POST",
    cookie: viewerCookie,
    body: {
      type: "REPORT_TEMPLATE",
      code: "DENIED",
      version: "1",
      title: "Denied",
      content: { a: 1 },
    },
  });

  const draft = await expectStatus("/api/admin/public-data", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      type: "EMISSION_FACTOR",
      code: "SMOKE_FACTOR",
      version: "1.0",
      title: "Test Factor",
      source: "Test source",
      content: { value: 0.5 },
    },
  });
  const beforePublish = await expectStatus("/api/public-data", 200, {
    cookie: schoolCookie,
  });
  assert.equal(beforePublish.entries.length, 0);
  await expectStatus(`/api/admin/public-data/${draft.entry.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      title: "Updated Test Factor",
      source: "Updated test source",
      content: { value: 0.6 },
    },
  });
  await expectStatus(`/api/admin/public-data/${draft.entry.id}/publish`, 200, {
    method: "POST",
    cookie: adminCookie,
  });
  const afterPublish = await expectStatus("/api/public-data", 200, {
    cookie: schoolCookie,
  });
  assert.equal(afterPublish.entries.length, 1);
  assert.equal(afterPublish.entries[0].code, "SMOKE_FACTOR");
  assert.equal(afterPublish.entries[0].content.value, 0.6);
  await expectStatus(`/api/admin/public-data/${draft.entry.id}`, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: { title: "Too Late", source: "Test", content: { value: 0.7 } },
  });
  await expectStatus("/api/auth/admin/create-user", 404, {
    method: "POST",
    cookie: adminCookie,
    body: {},
  });
  await expectStatus(`/api/admin/schools/${schoolA.school.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "INACTIVE" },
  });
  await expectStatus("/api/public-data", 403, { cookie: schoolCookie });
  await expectStatus("/api/public-data", 200, { cookie: viewerCookie });
  await expectStatus(`/api/admin/schools/${schoolA.school.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "ACTIVE" },
  });
  await expectStatus("/api/public-data", 200, { cookie: schoolCookie });
  await expectStatus(
    `/api/admin/users/${schoolAccount.user.id}/password`,
    200,
    {
      method: "POST",
      cookie: adminCookie,
      body: { newPassword },
    },
  );
  await expectStatus("/api/public-data", 401, { cookie: schoolCookie });
  const resetCookie = await signIn(schoolEmail, newPassword);
  await expectStatus(`/api/admin/users/${schoolAccount.user.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "INACTIVE" },
  });
  await expectStatus("/api/public-data", 401, { cookie: resetCookie });
  await expectStatus(`/api/admin/users/${schoolAccount.user.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "ACTIVE" },
  });
  const restoredCookie = await signIn(schoolEmail, newPassword);
  await expectStatus("/api/public-data", 200, { cookie: restoredCookie });
  await expectStatus(`/api/admin/users/${viewerAccount.user.id}`, 200, {
    method: "DELETE",
    cookie: adminCookie,
  });
  await expectStatus("/api/public-data", 401, { cookie: viewerCookie });
  await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: viewerEmail,
      displayName: "Replacement Viewer",
      password,
      schoolId: schoolB.school.id,
      role: "VIEWER",
    },
  });

  const testDb2 = new pg.Client({ connectionString: testUrl.toString() });
  await testDb2.connect();
  try {
    const { rows } = await testDb2.query(
      'SELECT count(*)::int AS count FROM "AuditLog"',
    );
    assert.ok(rows[0].count >= 5);
    const deleted = await testDb2.query(
      'SELECT "deletedAt", email FROM "User" WHERE id = $1',
      [viewerAccount.user.id],
    );
    assert.ok(deleted.rows[0].deletedAt);
    assert.notEqual(deleted.rows[0].email, viewerEmail);
    const memberships = await testDb2.query(
      'SELECT count(*)::int AS count FROM "SchoolMembership" WHERE "userId" = $1',
      [viewerAccount.user.id],
    );
    assert.equal(memberships.rows[0].count, 0);
  } finally {
    await testDb2.end();
  }
  console.log(
    "Stage 3 integration smoke passed: login, roles, schools, membership removal, account deletion, publication, password reset, deactivation, audit.",
  );
} catch (error) {
  console.error(serverLogs);
  throw error;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  if (databaseCreated) {
    await pgAdmin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [databaseName],
    );
    await pgAdmin.query(`DROP DATABASE "${databaseName}"`);
  }
  await pgAdmin.end().catch(() => {});
}
