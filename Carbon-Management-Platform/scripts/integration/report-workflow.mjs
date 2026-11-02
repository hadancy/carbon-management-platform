import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { chromium } from "playwright";

export async function verifyReportWorkflow({
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
  databaseUrl,
}) {
  const artifacts =
    process.env.T07_ACCEPTANCE_OUTPUT_DIR ??
    mkdtempSync(join(tmpdir(), "carbon-t07-"));
  mkdirSync(artifacts, { recursive: true });
  const pathFor = (report) => "/api/reports/" + report.id;
  const bodyFor = (revision) => ({
    revisionId: revision.id,
    expectedContentRevision: revision.contentRevision,
  });
  const create = (code, runId, cookie = schoolCookie, status = 201) =>
    expectStatus("/api/reports", status, {
      method: "POST",
      cookie,
      body: { code, calculationRunId: runId },
    });
  await expectStatus("/api/reports", 401);
  await create("DENIED_VIEWER", production.run.id, viewerCookie, 403);
  await create("DENIED_EDITOR", production.run.id, editorCookie, 403);
  await create("DENIED_PLATFORM", production.run.id, adminCookie, 403);
  await create("DENIED_TRIAL", trial.run.id, schoolCookie, 404);
  await create("DENIED_OTHER_SCHOOL", production.run.id, schoolBCookie, 404);
  const created = (await create("SYN_REPORT_001", production.run.id)).report;
  const path = pathFor(created);
  await create("SYN_REPORT_001", production.run.id, schoolCookie, 409);
  await expectStatus(path, 404, { cookie: schoolBCookie });
  const initial = (await expectStatus(path, 200, { cookie: schoolCookie }))
    .report;
  let first = initial.revisions[0];
  const source = initial.sourceSnapshot;
  assert.deepEqual(source.result, production.run.result);
  assert.equal(source.run.id, production.run.id);
  const firstPdf = "/api/report-revisions/" + first.id + "/pdf";
  const preview = (revision) =>
    "/api/report-revisions/" + revision.id + "/preview";
  await expectStatus(preview(first), 404, { cookie: schoolBCookie });
  await expectStatus(firstPdf, 409, { method: "POST", cookie: schoolCookie });
  await expectStatus(path + "/submit", 400, {
    method: "POST",
    cookie: schoolCookie,
    body: bodyFor(first),
  });
  await expectStatus(path, 400, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      ...bodyFor(first),
      content: { ...first.contentSnapshot, result: { footprintKgPerKwh: "0" } },
    },
  });
  await expectStatus(path, 403, {
    method: "PATCH",
    cookie: reviewerCookie,
    body: { ...bodyFor(first), content: first.contentSnapshot },
  });
  const content = {
    ...first.contentSnapshot,
    reportingDate: "2026-10-07",
    conclusion: "SYN TEST 报告流程，数值固定为核算审核快照。",
    dataQuality: "长中文分页与跨页表格验收。".repeat(170),
  };
  first = (
    await expectStatus(path, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: { ...bodyFor(first), content },
    })
  ).revision;
  await expectStatus(path, 409, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { revisionId: first.id, expectedContentRevision: 1, content },
  });
  await expectStatus(path + "/submit", 200, {
    method: "POST",
    cookie: schoolCookie,
    body: bodyFor(first),
  });
  await expectStatus(path, 409, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { ...bodyFor(first), content },
  });
  await expectStatus(path + "/review", 403, {
    method: "POST",
    cookie: schoolCookie,
    body: { ...bodyFor(first), decision: "APPROVE", reason: "禁止自审" },
  });
  await expectStatus(path + "/review", 400, {
    method: "POST",
    cookie: reviewerCookie,
    body: { ...bodyFor(first), decision: "REJECT", reason: "" },
  });
  await expectStatus(path + "/review", 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: {
      ...bodyFor(first),
      decision: "REJECT",
      reason: "SYN TEST 补充结论说明",
    },
  });
  let second = (
    await expectStatus(path + "/revisions", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: bodyFor(first),
    })
  ).revision;
  second = (
    await expectStatus(path, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: {
        ...bodyFor(second),
        content: {
          ...content,
          conclusion: "SYN TEST 修订后通过；历史数值不变。",
        },
      },
    })
  ).revision;
  await expectStatus(path + "/submit", 200, {
    method: "POST",
    cookie: schoolCookie,
    body: bodyFor(second),
  });
  await expectStatus(path + "/review", 409, {
    method: "POST",
    cookie: reviewerCookie,
    body: {
      ...bodyFor(first),
      decision: "APPROVE",
      reason: "旧修订不能审核当前版本",
    },
  });
  await expectStatus(path + "/review", 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: {
      ...bodyFor(second),
      decision: "APPROVE",
      reason: "SYN TEST 核算数值与报告一致",
    },
  });
  await expectStatus(path + "/review", 409, {
    method: "POST",
    cookie: reviewerCookie,
    body: { ...bodyFor(second), decision: "APPROVE", reason: "重复审核" },
  });
  await expectStatus(path, 409, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { ...bodyFor(second), content },
  });
  const pdfPath = "/api/report-revisions/" + second.id + "/pdf";
  await expectStatus(pdfPath, 403, { method: "POST", cookie: viewerCookie });
  await expectStatus(pdfPath, 403, { method: "POST", cookie: reviewerCookie });
  await expectStatus(pdfPath, 404, { method: "POST", cookie: schoolBCookie });
  const fetchFile = (method, cookie = schoolCookie) =>
    fetch(baseURL + pdfPath, { method, headers: { cookie, origin: baseURL } });
  const generated = await Promise.all([fetchFile("POST"), fetchFile("POST")]);
  assert.ok(generated.every((response) => response.status === 200));
  const [pdf, duplicate] = await Promise.all(
    generated.map(async (response) =>
      Buffer.from(await response.arrayBuffer()),
    ),
  );
  assert.ok(pdf.subarray(0, 5).toString() === "%PDF-");
  assert.deepEqual(pdf, duplicate);
  const fileHash = createHash("sha256").update(pdf).digest("hex");
  assert.equal(fileHash, generated[0].headers.get("x-pdf-file-hash"));
  assert.equal(generated[0].headers.get("cache-control"), "private, no-store");
  const sample = join(artifacts, "T07-long-chinese-v2.pdf");
  writeFileSync(sample, pdf);
  const extracted = spawnSync("pdftotext", ["-layout", sample, "-"], {
    encoding: "utf8",
  });
  assert.equal(
    extracted.status,
    0,
    extracted.stderr || "Install Poppler for PDF text acceptance",
  );
  for (const value of [
    source.result.display.totalEmissionsKg,
    source.result.display.gridEnergyKwh,
    source.result.display.footprintKgPerKwh,
    source.run.id,
    "DEMO",
    "SYN TEST",
    "数据质量与来源",
    "年度电量清单",
  ])
    assert.ok(extracted.stdout.includes(value), "PDF missing " + value);
  const pages = extracted.stdout.split("\f").filter((page) => page.trim());
  assert.ok(pages.length >= 4);
  const energyPages = pages.filter(
    (page) => page.includes("4000 kWh") && /20[2-5]\d-01-01/.test(page),
  );
  assert.ok(energyPages.length >= 2, "Annual-energy table must cross pages");
  for (const page of energyPages)
    assert.ok(
      page.includes("起止期间") && page.includes("来源与方法"),
      "Repeated table header missing",
    );
  await expectStatus(pdfPath, 404, { cookie: schoolBCookie });
  const third = (
    await expectStatus(path + "/revisions", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: bodyFor(second),
    })
  ).revision;
  await expectStatus(path + "/revisions", 409, {
    method: "POST",
    cookie: schoolCookie,
    body: bodyFor(second),
  });
  const caseDetail = (
    await expectStatus(accountingPath, 200, { cookie: schoolCookie })
  ).case;
  const draft = caseDetail.revisions.find(
    (revision) => revision.id === caseDetail.currentRevisionId,
  );
  await expectStatus(accountingPath, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: {
      expectedInputRevision: draft.inputRevision,
      ruleVersionId: draft.ruleVersionId,
      inputs: {
        ...draft.inputs,
        specification: "SYN TEST 修改核算不影响旧报告",
      },
    },
  });
  const retained = (await expectStatus(path, 200, { cookie: schoolCookie }))
    .report;
  assert.deepEqual(retained.sourceSnapshot, source);
  const retainedSecond = retained.revisions.find(
    (revision) => revision.id === second.id,
  );
  assert.equal(retainedSecond.status, "APPROVED");
  assert.ok(retainedSecond.contentHash);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await (await fetchFile("GET")).arrayBuffer()))
      .digest("hex"),
    fileHash,
  );
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const count = await db.query(
      'SELECT count(*)::int AS count FROM "ReportExport" WHERE "revisionId" = $1',
      [second.id],
    );
    assert.equal(count.rows[0].count, 1);
    const logs = await db.query(
      'SELECT DISTINCT action FROM "AuditLog" WHERE action LIKE $1',
      ["report.%"],
    );
    assert.ok(logs.rows.length >= 8);
    await db.query(
      'UPDATE "ReportRevision" SET "contentSnapshot" = $1 WHERE id = $2',
      [
        JSON.stringify({
          ...retainedSecond.contentSnapshot,
          conclusion: "SYN TEST 篡改",
        }),
        second.id,
      ],
    );
    try {
      await expectStatus(preview(second), 409, { cookie: schoolCookie });
      await expectStatus(pdfPath, 409, { cookie: schoolCookie });
    } finally {
      await db.query(
        'UPDATE "ReportRevision" SET "contentSnapshot" = $1 WHERE id = $2',
        [JSON.stringify(retainedSecond.contentSnapshot), second.id],
      );
    }
    await db.query(
      'UPDATE "ReportExport" SET content = $1 WHERE "revisionId" = $2',
      [Buffer.from("corrupt"), second.id],
    );
    try {
      await expectStatus(pdfPath, 409, { cookie: schoolCookie });
    } finally {
      await db.query(
        'UPDATE "ReportExport" SET content = $1 WHERE "revisionId" = $2',
        [pdf, second.id],
      );
    }
  } finally {
    await db.end();
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });
  async function openAs(cookie) {
    await context.clearCookies();
    await context.addCookies(
      cookie
        .split(";")
        .filter(Boolean)
        .map((entry) => {
          const [name, ...value] = entry.trim().split("=");
          return { name, value: value.join("="), url: baseURL };
        }),
    );
    await page.goto(baseURL + "/reports/" + created.id);
  }
  try {
    await openAs(schoolCookie);
    await page.getByLabel("结果分析与结论", { exact: true }).fill("");
    await page.getByText("未保存", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("结果分析与结论", { exact: true }).inputValue(),
      "",
    );
    await page.getByRole("button", { name: "提交审核", exact: true }).click();
    await page.getByText("请填写结果分析与结论", { exact: true }).waitFor();
    assert.equal(
      (await expectStatus(path, 200, { cookie: schoolCookie })).report
        .revisions[0].status,
      "DRAFT",
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page.getByText("报告草稿已保存", { exact: true }).waitFor();
    await page
      .getByLabel("结果分析与结论", { exact: true })
      .fill("SYN TEST 浏览器补充说明");
    await page.getByRole("button", { name: "提交审核", exact: true }).click();
    await page.getByText("待审核", { exact: true }).first().waitFor();
    const submittedInBrowser = (
      await expectStatus(path, 200, { cookie: schoolCookie })
    ).report.revisions[0];
    assert.equal(submittedInBrowser.status, "SUBMITTED");
    assert.equal(
      submittedInBrowser.contentSnapshot.conclusion,
      "SYN TEST 浏览器补充说明",
    );
    await openAs(reviewerCookie);
    await page.getByRole("button", { name: /^驳\s*回$/ }).click();
    await page
      .getByLabel("审核意见", { exact: true })
      .fill("SYN TEST 浏览器驳回");
    await page.getByRole("button", { name: "确认驳回", exact: true }).click();
    await page.getByText("已驳回", { exact: true }).first().waitFor();
    await openAs(schoolCookie);
    await page.getByRole("button", { name: "创建新修订", exact: true }).click();
    await page.getByText("报告修订 v4", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "report-editor.png"),
      fullPage: true,
    });
    await page.getByLabel("报告修订", { exact: true }).click();
    await page.getByText("v2 · 已通过 · 历史", { exact: true }).click();
    await page.getByRole("tab", { name: "报告预览", exact: true }).click();
    const frame = page.frameLocator('iframe[title="报告排版预览"]');
    await frame
      .getByRole("heading", { name: "核算结果（固定运行快照）", exact: true })
      .waitFor();
    assert.ok(
      (await frame.locator("body").innerText()).includes(
        source.result.display.footprintKgPerKwh,
      ),
    );
    await frame.locator("body").evaluate(async (element) => {
      await element.ownerDocument.fonts.ready;
    });
    await page
      .locator('iframe[title="报告排版预览"]')
      .waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe[title="报告排版预览"]');
      const container = iframe?.closest(".ant-spin-container");
      return (
        container &&
        !container.classList.contains("ant-spin-blur") &&
        Number(getComputedStyle(container).opacity) === 1
      );
    });
    await page.screenshot({
      path: join(artifacts, "report-history-preview.png"),
      fullPage: true,
    });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 PDF", exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "SYN_REPORT_001-v2.pdf");
    await download.saveAs(join(artifacts, "browser-v2.pdf"));
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(artifacts, "browser-v2.pdf")))
        .digest("hex"),
      fileHash,
    );
    await page
      .getByRole("button", { name: "返回报告列表", exact: true })
      .click();
    await page.getByRole("button", { name: "生成报告", exact: true }).click();
    await page
      .getByLabel("报告编号", { exact: true })
      .fill("SYN_BROWSER_CREATED");
    await page
      .getByRole("button", { name: "生成报告草稿", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "SYN_BROWSER_CREATED", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "返回报告列表", exact: true })
      .click();
    await page
      .getByLabel("搜索报告", { exact: true })
      .fill("SYN_BROWSER_CREATED");
    await page
      .getByRole("link", { name: "SYN_BROWSER_CREATED", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "SYN_REPORT_001", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({
      path: join(artifacts, "browser-failure.png"),
      fullPage: true,
    });
    writeFileSync(
      join(artifacts, "browser-failure.txt"),
      await page.locator("body").innerText(),
    );
    console.error("T07 browser failure artifacts: " + artifacts);
    throw error;
  } finally {
    await browser.close();
  }
  const result = {
    checkedAt: new Date().toISOString(),
    scope: "T07_SYNTHETIC_WORKFLOW",
    status: "PASSED",
    reportId: created.id,
    calculationRunId: source.run.id,
    approvedRevisionId: second.id,
    thirdRevisionId: third.id,
    pdfFileHash: fileHash,
    pageCount: pages.length,
    annualEnergyTablePages: energyPages.length,
    browserErrors: errors,
    checks: [
      "来源仅接受已审核正式运行",
      "角色矩阵及禁止自审",
      "草稿与提交校验分离",
      "拒绝数值改写",
      "乐观锁及旧目标拦截",
      "驳回与新修订",
      "已审核版冻结",
      "页面与PDF数值一致",
      "中文长文分页及跨页表头",
      "并发导出只有一个文件",
      "旧PDF字节不变",
      "篡改摘要拦截",
      "跨校详情预览下载隔离",
      "浏览器编辑审核修订预览导出",
      "浏览器列表创建与搜索",
      "无控制台警告",
    ],
  };
  writeFileSync(
    join(artifacts, "T07-report-workflow-result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("T07 report workflow passed: " + artifacts);
  return result;
}
