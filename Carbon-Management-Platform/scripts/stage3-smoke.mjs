import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyWorkflowFixes } from "./integration/workflow-fixes.mjs";
import { verifyLoad } from "./ops/load-check.mjs";
import { verifyRecovery } from "./ops/recovery-check.mjs";
import pg from "pg";
import {
  runAccountingAcceptanceRegression,
  verifyPersistentPvDemo,
} from "./integration/accounting-acceptance.mjs";
import { verifyReportWorkflow } from "./integration/report-workflow.mjs";
import { verifyDataItemLibrary } from "./integration/data-items.mjs";
import { verifyDataItemDeletion } from "./integration/data-item-deletion.mjs";
import {
  attachCatalogItems,
  verifyModelDataItemReferences,
} from "./integration/model-data-items.mjs";

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
const reviewerEmail = `stage4-reviewer-${randomUUID()}@example.test`;
const editorEmail = `stage4-editor-${randomUUID()}@example.test`;
const schoolBEmail = `stage4-school-b-${randomUUID()}@example.test`;
const schoolBReviewerEmail = `stage5-school-b-reviewer-${randomUUID()}@example.test`;
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
  await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: reviewerEmail,
      displayName: "Test Reviewer",
      password,
      schoolId: schoolA.school.id,
      role: "REVIEWER",
    },
  });
  await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: editorEmail,
      displayName: "Test Model Editor",
      password,
      schoolId: schoolA.school.id,
      role: "MODEL_EDITOR",
    },
  });
  await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: schoolBEmail,
      displayName: "Test School B Admin",
      password,
      schoolId: schoolB.school.id,
      role: "SCHOOL_ADMIN",
    },
  });
  await expectStatus("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      email: schoolBReviewerEmail,
      displayName: "Test School B Reviewer",
      password,
      schoolId: schoolB.school.id,
      role: "REVIEWER",
    },
  });
  const schoolCookie = await signIn(schoolEmail);
  const viewerCookie = await signIn(viewerEmail);
  const reviewerCookie = await signIn(reviewerEmail);
  const editorCookie = await signIn(editorEmail);
  const schoolBCookie = await signIn(schoolBEmail);
  const schoolBReviewerCookie = await signIn(schoolBReviewerEmail);
  await verifyModelDataItemReferences({
    expectStatus,
    baseURL,
    adminCookie,
    schoolCookie,
    schoolBCookie,
    viewerCookie,
    reviewerCookie,
    databaseUrl: testUrl.toString(),
  });
  await verifyDataItemLibrary({
    api,
    expectStatus,
    baseURL,
    adminCookie,
    schoolCookie,
    viewerCookie,
    databaseUrl: testUrl.toString(),
  });
  await verifyDataItemDeletion({
    api,
    expectStatus,
    baseURL,
    adminCookie,
    schoolCookie,
    viewerCookie,
    reviewerCookie,
    databaseUrl: testUrl.toString(),
  });
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

  const factorV2 = (value) => ({
    schemaVersion: 2,
    purpose: "TEST",
    value,
    activityUnit: "kWh",
    emissionUnit: "kgCO2e",
    note: "集成测试",
    applicability: {
      product: "PV",
      stage: "CS",
      subject: "ALL",
      region: "ALL",
      technology: "ALL",
      validFrom: "2020-01-01",
      validTo: "2035-12-31",
      dataYear: 2024,
      boundary: "测试施工用电",
    },
    evidence: {
      sourceCategory: "OTHER",
      issuer: "测试",
      reference: "stage3-smoke",
      publishedAt: "2024-01-01",
      originalValue: value,
      conversion: "不换算",
      license: "仅测试",
    },
    governance: {
      basis: "stage3-smoke",
      changeReason: "测试版本",
      supersedesVersionId: null,
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
      content: factorV2("0.5"),
    },
  });
  const beforePublish = await expectStatus("/api/public-data", 200, {
    cookie: schoolCookie,
  });
  assert.equal(beforePublish.entries.length, 0);
  const incompleteFactor = await expectStatus("/api/admin/public-data", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      type: "EMISSION_FACTOR",
      code: "SMOKE_INCOMPLETE_FACTOR",
      version: "1.0",
      title: "Incomplete Factor",
      source: "Test source",
      content: {
        value: "",
        activityUnit: "",
        emissionUnit: "kgCO2e",
        note: "",
      },
    },
  });
  await expectStatus(
    `/api/admin/public-data/${incompleteFactor.entry.id}/publish`,
    400,
    { method: "POST", cookie: adminCookie },
  );
  await expectStatus(`/api/admin/public-data/${draft.entry.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      title: "Updated Test Factor",
      source: "Updated test source",
      content: factorV2("0.6"),
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
  assert.equal(afterPublish.entries[0].content.value, "0.6");
  assert.equal(afterPublish.entries[0].content.activityUnit, "kWh");
  await expectStatus(`/api/admin/public-data/${draft.entry.id}/retire`, 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { reason: "测试停用" },
  });
  await expectStatus(`/api/admin/public-data/${draft.entry.id}/retire`, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { reason: "" },
  });
  const retired = await expectStatus(
    `/api/admin/public-data/${draft.entry.id}/retire`,
    200,
    {
      method: "POST",
      cookie: adminCookie,
      body: { reason: "测试版本停用" },
    },
  );
  assert.ok(retired.entry.retiredAt);
  assert.equal(retired.entry.content.value, "0.6");
  await expectStatus(`/api/admin/public-data/${draft.entry.id}/retire`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { reason: "重复停用" },
  });
  const afterRetirement = await expectStatus("/api/public-data", 200, {
    cookie: schoolCookie,
  });
  assert.equal(afterRetirement.entries[0].retirementReason, "测试版本停用");
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

  // Simulate an older client still sending the removed field; the API must discard it.
  const modelContent = {
    name: "测试通用模型",
    productType: "测试产品",
    functionalQuantity: 1,
    functionalUnit: "件",
    functionalDescription: "测试产品",
    boundary: "从摇篮到大门",
    boundaryDiagram: "",
    referenceStandard: "测试标准",
    description: "仅用于临时数据库集成测试",
    stages: [
      {
        id: randomUUID(),
        name: "原材料",
        categories: [
          {
            id: randomUUID(),
            name: "材料",
            items: [
              {
                id: randomUUID(),
                dataName: "钢材",
                specModel: "",
                manufacturer: "",
                carbonFootprintFactor: "",
                functionalUnit: "kg",
                emissionFactor: "2",
                factorSource: "",
                dataSource: "",
              },
            ],
          },
        ],
      },
    ],
  };
  await attachCatalogItems({
    content: modelContent,
    prefix: "SMOKE_ITEM",
    expectStatus,
    adminCookie,
  });
  const publicModel = await expectStatus("/api/admin/models", 201, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SMOKE_TEMPLATE", content: modelContent },
  });
  assert.equal("productType" in publicModel.model.versions[0].content, false);
  const duplicatePublicModel = await expectStatus("/api/admin/models", 409, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SMOKE_TEMPLATE", content: modelContent },
  });
  assert.match(duplicatePublicModel.error, /公用模板编码已存在/);
  const publicVersionId = publicModel.model.versions[0].id;
  const incompleteContent = structuredClone(modelContent);
  incompleteContent.stages.push({
    id: randomUUID(),
    name: "运输",
    categories: [],
  });
  await expectStatus(`/api/model-versions/${publicVersionId}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: incompleteContent,
  });
  await expectStatus(`/api/model-versions/${publicVersionId}/transition`, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { action: "publish" },
  });
  await expectStatus(`/api/model-versions/${publicVersionId}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: modelContent,
  });
  await expectStatus(
    `/admin/models/${publicModel.model.id}/versions/${publicVersionId}`,
    200,
    { cookie: adminCookie },
  );
  await expectStatus(
    `/models/${publicModel.model.id}/versions/${publicVersionId}`,
    404,
    { cookie: schoolCookie },
  );
  await expectStatus(`/api/model-versions/${publicVersionId}/transition`, 404, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "publish" },
  });
  const publishedPublicVersion = await expectStatus(
    `/api/model-versions/${publicVersionId}/transition`,
    200,
    {
      method: "POST",
      cookie: adminCookie,
      body: { action: "publish" },
    },
  );
  assert.equal(
    publishedPublicVersion.version.content.stages[0].categories[0].items[0]
      .emissionFactor,
    "2",
  );
  const publicVersionPage = await fetch(
    `${baseURL}/models/${publicModel.model.id}/versions/${publicVersionId}`,
    { headers: { cookie: schoolCookie } },
  );
  assert.equal(publicVersionPage.status, 200);
  assert.match(await publicVersionPage.text(), /返回模型列表/);
  await expectStatus(`/api/model-versions/${publicVersionId}`, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: modelContent,
  });
  const schoolModel = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "SHARED_CODE", sourceVersionId: publicVersionId },
  });
  const duplicateSchoolModel = await expectStatus("/api/models", 409, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "SHARED_CODE", content: modelContent },
  });
  assert.match(duplicateSchoolModel.error, /本校模型编码已存在/);
  assert.equal("productType" in schoolModel.model.versions[0].content, false);
  const schoolVersionId = schoolModel.model.versions[0].id;
  await expectStatus(
    `/models/${schoolModel.model.id}/versions/${schoolVersionId}`,
    200,
    { cookie: schoolCookie },
  );
  await expectStatus(
    `/models/${schoolModel.model.id}/versions/${schoolVersionId}`,
    404,
    { cookie: schoolBCookie },
  );
  await expectStatus(
    `/admin/models/${schoolModel.model.id}/versions/${schoolVersionId}`,
    404,
    { cookie: adminCookie },
  );
  const schoolPage = await fetch(`${baseURL}/models`, {
    headers: { cookie: schoolCookie },
  });
  assert.equal(schoolPage.status, 200);
  const schoolPageHtml = await schoolPage.text();
  assert.match(schoolPageHtml, /SHARED_CODE/);
  assert.match(
    schoolPageHtml,
    new RegExp(`/models/${schoolModel.model.id}/versions/${schoolVersionId}`),
  );
  const otherSchoolPage = await fetch(`${baseURL}/models`, {
    headers: { cookie: schoolBCookie },
  });
  assert.equal(otherSchoolPage.status, 200);
  assert.doesNotMatch(await otherSchoolPage.text(), /SHARED_CODE/);
  await expectStatus("/admin/models", 200, { cookie: adminCookie });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 404, {
    method: "POST",
    cookie: adminCookie,
    body: { action: "publish" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}`, 404, {
    method: "PATCH",
    cookie: schoolBCookie,
    body: modelContent,
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "submit" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "publish" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: { action: "reject", note: "请复核数据项" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}`, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: modelContent,
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "submit" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}/transition`, 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: { action: "publish" },
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}`, 409, {
    method: "PATCH",
    cookie: schoolCookie,
    body: modelContent,
  });
  // T04–T05: use synthetic PV data in the disposable test database only.
  const pvStages = ["RS", "TR", "CS", "US", "TD"];
  const pvUnits = ["kg", "t_km", "kWh", "kWh", "kWh"];
  const pvValues = ["2", "0.1", "0.5", "0.5", "0.0046"];
  const pvNames = ["材料", "运输", "施工电力", "运行电力", "输配电"];
  const pvStageIds = pvStages.map(() => randomUUID());
  const pvItemIds = pvStages.map(() => randomUUID());
  const pvContent = {
    name: "SYN-PV-001 集成测试模型",
    functionalQuantity: 1,
    functionalUnit: "kWh",
    functionalDescription: "1 kWh",
    boundary: "合成五阶段",
    boundaryDiagram: "",
    referenceStandard: "SYN-PV-001",
    description: "TEST，不用于真实业务",
    stages: pvStages.map((stage, index) => ({
      id: pvStageIds[index],
      name: stage,
      categories: [
        {
          id: randomUUID(),
          name: "测试",
          items: [
            {
              id: pvItemIds[index],
              dataName: pvNames[index],
              specModel: "",
              manufacturer: "",
              carbonFootprintFactor: "",
              functionalUnit: pvUnits[index],
              emissionFactor: pvValues[index],
              factorSource: "SYN-PV-001",
              dataSource: "TEST",
            },
          ],
        },
      ],
    })),
    calculationProfile: {
      product: "PV",
      formula: "PV_GRID_V1",
      stageMappings: pvStages.map((stage, index) => ({
        stageId: pvStageIds[index],
        calculationStage: stage,
      })),
      itemMappings: pvStages.map((stage, index) => ({
        itemId: pvItemIds[index],
        role:
          stage === "TR"
            ? "TRANSPORT"
            : stage === "TD"
              ? "GRID_FACTOR"
              : "ACTIVITY",
        factorActivityUnit: pvUnits[index],
      })),
    },
  };
  await attachCatalogItems({
    content: pvContent,
    prefix: "SMOKE_PV_ITEM",
    expectStatus,
    adminCookie,
  });
  const pvModel = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "SYN_PV_001", content: pvContent },
  });
  const pvVersionId = pvModel.model.versions[0].id;
  await expectStatus(`/api/model-versions/${pvVersionId}/transition`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "submit" },
  });
  await expectStatus(`/api/model-versions/${pvVersionId}/transition`, 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: { action: "publish" },
  });
  await expectStatus("/api/accounting/cases", 403, {
    method: "POST",
    cookie: viewerCookie,
    body: { code: "DENIED", product: "test", modelVersionId: pvVersionId },
  });
  const accounting = await expectStatus("/api/accounting/cases", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: {
      code: "SYN_PV_CASE",
      product: "合成光伏案例",
      modelVersionId: pvVersionId,
    },
  });
  const accountingPath = `/api/accounting/cases/${accounting.case.id}`;
  await expectStatus(accountingPath, 404, { cookie: schoolBCookie });
  await expectStatus(`/accounting/${accounting.case.id}`, 200, {
    cookie: schoolCookie,
  });
  const pdfForm = new FormData();
  pdfForm.append(
    "file",
    new Blob(["%PDF-1.4\nsynthetic evidence\n"], { type: "application/pdf" }),
    "synthetic.pdf",
  );
  const uploadedResponse = await fetch(`${baseURL}/api/files`, {
    method: "POST",
    headers: { cookie: schoolCookie, origin: baseURL },
    body: pdfForm,
  });
  assert.equal(uploadedResponse.status, 201);
  const uploaded = await uploadedResponse.json();
  assert.equal(
    (
      await fetch(`${baseURL}/api/files/${uploaded.asset.id}`, {
        headers: { cookie: schoolBCookie },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${baseURL}/api/files/${uploaded.asset.id}`, {
        headers: { cookie: schoolCookie },
      })
    ).status,
    200,
  );
  const energy = Array.from({ length: 25 }, (_, index) => ({
    operatingYear: index + 1,
    periodStart: `${2026 + index}-01-01`,
    periodEnd: `${2026 + index}-12-31`,
    source: "ESTIMATED",
    value: "4000",
    unit: "kWh",
    evidence: "SYN-PV-001",
    evidenceAssetIds: [uploaded.asset.id],
    method: "合成固定值",
  }));
  const pvLines = pvItemIds.map((itemId, index) => ({
    itemId,
    state: "RECORDED",
    activityDate: "2026-09-29",
    location: "合成地点",
    process: "合成工艺",
    measurementMethod: "合成计量",
    sourceType: "ACTUAL",
    evidence: "SYN-PV-001",
    evidenceAssetIds: [uploaded.asset.id],
    ...(index === 1
      ? { weight: "2", weightUnit: "t", distance: "100", distanceUnit: "km" }
      : index === 4
        ? {}
        : { value: ["2000", "", "1000", "2000"][index], unit: pvUnits[index] }),
  }));
  const pvInputs = {
    specification: "合成并网光伏项目",
    measurementUnit: "kWh",
    projectLocation: "中国测试地点",
    collectionStart: "2026-01-01",
    collectionEnd: "2026-12-31",
    boundaryNote: "合成五阶段边界",
    exclusionNote: "无",
    referenceDate: "2026-09-29",
    region: "中国",
    technology: "光伏",
    operatingYears: 25,
    annualEnergy: energy,
    directSupplyKwh: "0",
    lossRatio: "0.05",
    transmissionMethod: "GRID_FACTOR_FALLBACK",
    transmissionFallbackReason: "合成数据无 SF6 实测资料",
    lines: pvLines,
  };
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { expectedInputRevision: 1, ruleVersionId: null, inputs: pvInputs },
  });
  await expectStatus(accountingPath, 409, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { expectedInputRevision: 1, ruleVersionId: null, inputs: pvInputs },
  });
  const trialRequestId = randomUUID();
  const trial = await expectStatus(`${accountingPath}/runs`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId: trialRequestId, mode: "TRIAL" },
  });
  assert.equal(trial.run.result.display.footprintKgPerKwh, "0.062947");
  const trialSnapshot = await expectStatus(
    `/api/accounting/runs/${trial.run.id}`,
    200,
    { cookie: schoolCookie },
  );
  assert.equal(trialSnapshot.run.snapshots.modelVersion.id, pvVersionId);
  await expectStatus(`/api/accounting/runs/${trial.run.id}`, 404, {
    cookie: schoolBCookie,
  });
  const repeatedTrial = await expectStatus(`${accountingPath}/runs`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId: trialRequestId, mode: "TRIAL" },
  });
  assert.equal(repeatedTrial.run.id, trial.run.id);
  await expectStatus(`${accountingPath}/submit`, 409, {
    method: "POST",
    cookie: schoolCookie,
    body: { runId: trial.run.id, expectedInputRevision: 2 },
  });
  const ruleDraft = await expectStatus("/api/admin/public-data", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      type: "RULE_CONFIG",
      code: "SYN_PV_RULE",
      version: "1",
      title: "合成规则",
      source: "SYN-PV-001",
      content: {
        schemaVersion: 1,
        product: "PV",
        scenario: "GRID_ONLY",
        formula: "PV_GRID_V1",
        purpose: "PRODUCTION",
        standardReference: "SYN-PV-001 TEST",
        effectiveFrom: "2020-01-01",
        effectiveTo: "2060-12-31",
        approvalReference: "SYN-PV-001 TEST ONLY",
      },
    },
  });
  await expectStatus(
    `/api/admin/public-data/${ruleDraft.entry.id}/publish`,
    200,
    { method: "POST", cookie: adminCookie },
  );
  const pvFactorIds = [];
  for (const [index, stage] of pvStages.entries()) {
    const factorContent = factorV2(pvValues[index]);
    factorContent.purpose = "PRODUCTION";
    factorContent.activityUnit = pvUnits[index];
    factorContent.applicability.stage = stage;
    factorContent.applicability.subject = pvNames[index];
    factorContent.applicability.validTo = "2060-12-31";
    factorContent.evidence.reference = "SYN-PV-001 TEST";
    const next = await expectStatus("/api/admin/public-data", 201, {
      method: "POST",
      cookie: adminCookie,
      body: {
        type: "EMISSION_FACTOR",
        code: `SYN_PV_${stage}`,
        version: "1",
        title: `合成因子 ${stage}`,
        source: "SYN-PV-001 TEST",
        content: factorContent,
      },
    });
    await expectStatus(`/api/admin/public-data/${next.entry.id}/publish`, 200, {
      method: "POST",
      cookie: adminCookie,
    });
    pvFactorIds.push(next.entry.id);
  }
  const productionInputs = {
    ...pvInputs,
    lines: pvLines.map((line, index) => ({
      ...line,
      factorVersionId: pvFactorIds[index],
    })),
  };
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      expectedInputRevision: 2,
      ruleVersionId: ruleDraft.entry.id,
      inputs: productionInputs,
    },
  });
  await expectStatus(`${accountingPath}/runs`, 403, {
    method: "POST",
    cookie: viewerCookie,
    body: { requestId: randomUUID(), mode: "PRODUCTION" },
  });
  const production = await expectStatus(`${accountingPath}/runs`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { requestId: randomUUID(), mode: "PRODUCTION" },
  });
  assert.equal(production.run.result.display.footprintKgPerKwh, "0.062947");
  await expectStatus(`${accountingPath}/submit`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { runId: production.run.id, expectedInputRevision: 3 },
  });
  await expectStatus(`${accountingPath}/review`, 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { decision: "APPROVE", reason: "自审应被拒绝" },
  });
  await expectStatus(`${accountingPath}/review`, 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: { decision: "APPROVE", reason: "合成测试通过" },
  });
  await expectStatus(`${accountingPath}/review`, 409, {
    method: "POST",
    cookie: reviewerCookie,
    body: { decision: "APPROVE", reason: "重复审核" },
  });
  const nextRevision = await expectStatus(`${accountingPath}/revisions`, 201, {
    method: "POST",
    cookie: schoolCookie,
    body: {},
  });
  assert.equal(nextRevision.revision.revisionNo, 2);
  const savedCase = await expectStatus(accountingPath, 200, {
    cookie: schoolCookie,
  });
  assert.equal(
    savedCase.case.revisions.find((revision) => revision.revisionNo === 1)
      .status,
    "APPROVED",
  );
  assert.equal(
    savedCase.case.revisions
      .find((revision) => revision.revisionNo === 1)
      .runs.find((run) => run.id === production.run.id).result.display
      .footprintKgPerKwh,
    "0.062947",
  );
  const pvModelB = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolBCookie,
    body: { code: "SYN_PV_B", content: pvContent },
  });
  const pvVersionB = pvModelB.model.versions[0].id;
  await expectStatus(`/api/model-versions/${pvVersionB}/transition`, 200, {
    method: "POST",
    cookie: schoolBCookie,
    body: { action: "submit" },
  });
  await expectStatus(`/api/model-versions/${pvVersionB}/transition`, 200, {
    method: "POST",
    cookie: schoolBReviewerCookie,
    body: { action: "publish" },
  });
  const caseB = await expectStatus("/api/accounting/cases", 201, {
    method: "POST",
    cookie: schoolBCookie,
    body: {
      code: "SYN_PV_B_CASE",
      product: "学校 B 合成案例",
      modelVersionId: pvVersionB,
    },
  });
  const caseBPath = `/api/accounting/cases/${caseB.case.id}`;
  await expectStatus(caseBPath, 404, { cookie: schoolCookie });
  const pvInputsB = {
    ...pvInputs,
    annualEnergy: energy.map((entry) => ({ ...entry, evidenceAssetIds: [] })),
    lines: pvLines.map((line) => ({ ...line, evidenceAssetIds: [] })),
  };
  await expectStatus(caseBPath, 200, {
    method: "PATCH",
    cookie: schoolBCookie,
    body: { expectedInputRevision: 1, ruleVersionId: null, inputs: pvInputsB },
  });
  const trialB = await expectStatus(`${caseBPath}/runs`, 201, {
    method: "POST",
    cookie: schoolBCookie,
    body: { requestId: randomUUID(), mode: "TRIAL" },
  });
  assert.equal(trialB.run.result.display.footprintKgPerKwh, "0.062947");
  await runAccountingAcceptanceRegression({
    expectStatus,
    adminCookie,
    schoolCookie,
    reviewerCookie,
    schoolBCookie,
    accountingPath,
    productionInputs,
    production,
    ruleDraft,
    pvFactorIds,
  });
  const reportChecks = await verifyReportWorkflow({
    baseURL,
    expectStatus,
    schoolCookie,
    reviewerCookie,
    schoolBCookie,
    viewerCookie,
    editorCookie,
    adminCookie,
    production,
    trial,
    accountingPath,
    databaseUrl: testUrl.toString(),
  });
  const fixes = await verifyWorkflowFixes({
    baseURL,
    expectStatus,
    schoolCookie,
    schoolBCookie,
    reviewerCookie,
    adminCookie,
    production,
    accountingPath,
    databaseUrl: testUrl.toString(),
  });
  if (process.env.RUN_RELEASE_CHECKS === "1") {
    const load = await verifyLoad({
      databaseUrl: testUrl.toString(),
      baseURL,
      schoolCookie,
      schoolBCookie,
      accountingPath,
      pdfPath: `/api/report-revisions/${reportChecks.approvedRevisionId}/pdf`,
    });
    const recovery = await verifyRecovery({
      databaseUrl: testUrl.toString(),
      env,
    });
    const output = mkdtempSync(join(tmpdir(), "carbon-release-check-"));
    writeFileSync(
      join(output, "release-result.json"),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          status: "PASSED",
          fixes,
          load,
          recovery,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Release rehearsal results: " + output);
  }
  const secondSchoolModel = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolBCookie,
    body: { code: "SHARED_CODE", content: modelContent },
  });
  assert.notEqual(secondSchoolModel.model.id, schoolModel.model.id);
  await expectStatus(`/api/models/${schoolModel.model.id}/versions`, 404, {
    method: "POST",
    cookie: schoolBCookie,
    body: {},
  });
  const newVersion = await expectStatus(
    `/api/models/${schoolModel.model.id}/versions`,
    201,
    {
      method: "POST",
      cookie: schoolCookie,
      body: {},
    },
  );
  assert.equal(newVersion.version.version, 2);
  assert.equal(newVersion.version.status, "DRAFT");

  await expectStatus(`/api/models/${schoolModel.model.id}`, 404, {
    method: "DELETE",
    cookie: schoolBCookie,
  });
  await expectStatus(`/api/models/${schoolModel.model.id}`, 403, {
    method: "DELETE",
    cookie: editorCookie,
  });
  await expectStatus(`/api/models/${schoolModel.model.id}`, 409, {
    method: "DELETE",
    cookie: reviewerCookie,
  });
  await expectStatus(`/api/model-versions/${schoolVersionId}`, 409, {
    method: "DELETE",
    cookie: schoolCookie,
  });
  await expectStatus(`/api/model-versions/${newVersion.version.id}`, 404, {
    method: "DELETE",
    cookie: schoolBCookie,
  });
  await expectStatus(`/api/model-versions/${newVersion.version.id}`, 200, {
    method: "DELETE",
    cookie: schoolCookie,
  });
  const afterDraftDeletion = await fetch(`${baseURL}/models`, {
    headers: { cookie: schoolCookie },
  });
  const afterDraftDeletionHtml = await afterDraftDeletion.text();
  assert.match(
    afterDraftDeletionHtml,
    new RegExp(`/models/${schoolModel.model.id}/versions/${schoolVersionId}`),
  );
  assert.ok(!afterDraftDeletionHtml.includes(newVersion.version.id));
  await expectStatus(`/api/models/${schoolModel.model.id}`, 200, {
    method: "DELETE",
    cookie: reviewerCookie,
  });
  await expectStatus(`/api/models/${schoolModel.model.id}`, 404, {
    method: "DELETE",
    cookie: reviewerCookie,
  });
  await expectStatus(`/api/model-versions/${newVersion.version.id}`, 404, {
    method: "PATCH",
    cookie: schoolCookie,
    body: modelContent,
  });
  const archivedSchoolPage = await fetch(`${baseURL}/models`, {
    headers: { cookie: schoolCookie },
  });
  assert.doesNotMatch(await archivedSchoolPage.text(), /SHARED_CODE/);
  await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "SHARED_CODE", content: modelContent },
  });
  const draftToDelete = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "DRAFT_DELETE", content: modelContent },
  });
  await expectStatus(`/api/models/${draftToDelete.model.id}`, 403, {
    method: "DELETE",
    cookie: editorCookie,
  });
  await expectStatus(
    `/api/model-versions/${draftToDelete.model.versions[0].id}`,
    200,
    { method: "DELETE", cookie: editorCookie },
  );
  const retainedCopy = await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolBCookie,
    body: { code: "RETAINED_COPY", sourceVersionId: publicVersionId },
  });

  await expectStatus(`/api/models/${publicModel.model.id}`, 403, {
    method: "DELETE",
    cookie: schoolCookie,
  });
  await expectStatus(`/api/models/${publicModel.model.id}`, 200, {
    method: "DELETE",
    cookie: adminCookie,
  });
  const retainedCopyPage = await fetch(`${baseURL}/models`, {
    headers: { cookie: schoolBCookie },
  });
  assert.match(await retainedCopyPage.text(), /RETAINED_COPY/);
  assert.ok(retainedCopy.model.sourceVersionId === publicVersionId);
  await expectStatus("/api/models", 400, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "ARCHIVED_COPY", sourceVersionId: publicVersionId },
  });
  await expectStatus("/api/admin/models", 201, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SMOKE_TEMPLATE", content: modelContent },
  });

  await expectStatus(`/api/admin/schools/${schoolA.school.id}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "INACTIVE" },
  });
  await expectStatus("/api/public-data", 403, { cookie: schoolCookie });
  await expectStatus("/api/data-items", 403, { cookie: schoolCookie });
  await expectStatus("/api/public-data", 200, { cookie: viewerCookie });
  await expectStatus("/api/data-items", 200, { cookie: viewerCookie });
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
  await verifyPersistentPvDemo({ env, expectStatus, signIn });
  console.log(
    "Stage 3–7 integration smoke passed: identity, schools, factor and model publication, accounting trial and approval, immutable revisions, two-school isolation, evidence access, audit, persistent demo workflow, and report editing, review, preview, immutable PDF exports and browser acceptance.",
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
