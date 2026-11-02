import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { chromium } from "playwright";

export async function verifyWorkflowFixes({
  baseURL,
  expectStatus,
  schoolCookie,
  schoolBCookie,
  reviewerCookie,
  adminCookie,
  production,
  accountingPath,
  databaseUrl,
}) {
  const artifacts = mkdtempSync(join(tmpdir(), "carbon-flow-fixes-"));
  const rule = {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    formula: "PV_GRID_V1",
    purpose: "TEST",
    standardReference: "SYN TEST",
    effectiveFrom: "2020-01-01",
    effectiveTo: "2060-12-31",
    approvalReference: "SYN TEST ONLY",
  };
  for (const [index, content] of [
    { description: "故意省略用途、公式与期间" },
    { ...rule, formula: "UNCONFIRMED" },
    { ...rule, effectiveTo: "2019-12-31" },
  ].entries()) {
    const draft = (
      await expectStatus("/api/admin/public-data", 201, {
        method: "POST",
        cookie: adminCookie,
        body: {
          type: "RULE_CONFIG",
          code: `NEG_RULE_${index}`,
          version: "1",
          title: "TEST 非法规则",
          source: "SYN TEST",
          content,
        },
      })
    ).entry;
    await expectStatus(`/api/admin/public-data/${draft.id}/publish`, 400, {
      method: "POST",
      cookie: adminCookie,
    });
  }
  const template = {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    layoutVersion: "pv-report-1.0.2",
    purpose: "TEST",
    approvalReference: "SYN TEST 模板工程确认",
    titleSuffix: "碳足迹核算工程验收测试报告",
    preparedBy: "TEST 模板机构",
    defaults: {
      purpose: "SYN TEST 公共模板目的",
      methodology: "",
      dataQuality: "",
      conclusion: "SYN TEST 模板结论",
      limitations: "",
    },
  };
  const invalid = (
    await expectStatus("/api/admin/public-data", 201, {
      method: "POST",
      cookie: adminCookie,
      body: {
        type: "REPORT_TEMPLATE",
        code: "NEG_TEMPLATE",
        version: "1",
        title: "TEST 非法模板",
        content: { description: "未定义映射" },
      },
    })
  ).entry;
  await expectStatus(`/api/admin/public-data/${invalid.id}/publish`, 400, {
    method: "POST",
    cookie: adminCookie,
  });
  const version = (
    await expectStatus("/api/admin/public-data", 201, {
      method: "POST",
      cookie: adminCookie,
      body: {
        type: "REPORT_TEMPLATE",
        code: "SYN_PUBLIC_TEMPLATE",
        version: "1",
        title: "TEST 受控模板",
        content: template,
      },
    })
  ).entry;
  await expectStatus(`/api/admin/public-data/${version.id}/publish`, 200, {
    method: "POST",
    cookie: adminCookie,
  });
  await expectStatus("/api/reports", 400, {
    method: "POST",
    cookie: schoolCookie,
    body: {
      code: "INVALID_TEMPLATE_USE",
      calculationRunId: production.run.id,
      templateVersionId: invalid.id,
    },
  });
  const created = (
    await expectStatus("/api/reports", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: {
        code: "SYN_TEMPLATE_REPORT",
        calculationRunId: production.run.id,
        templateVersionId: version.id,
      },
    })
  ).report;
  const path = `/api/reports/${created.id}`;
  const report = (await expectStatus(path, 200, { cookie: schoolCookie }))
    .report;
  assert.equal(report.templateSnapshot.id, version.id);
  assert.equal(
    report.revisions[0].contentSnapshot.purpose,
    template.defaults.purpose,
  );
  assert.deepEqual(report.sourceSnapshot.result, production.run.result);
  const revision = report.revisions[0];
  const target = {
    revisionId: revision.id,
    expectedContentRevision: revision.contentRevision,
  };
  const longTitle =
    "合成并网光伏项目全生命周期产品碳足迹核算与数据追溯工程流程验收测试报告";
  const saved = (
    await expectStatus(path, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: {
        ...target,
        content: {
          ...revision.contentSnapshot,
          title: longTitle,
          reportingDate: "2026-10-08",
        },
      },
    })
  ).revision;
  const body = {
    revisionId: saved.id,
    expectedContentRevision: saved.contentRevision,
  };
  await expectStatus(path + "/submit", 200, {
    method: "POST",
    cookie: schoolCookie,
    body,
  });
  await expectStatus(path + "/review", 200, {
    method: "POST",
    cookie: reviewerCookie,
    body: {
      ...body,
      decision: "APPROVE",
      reason: "SYN TEST 模板与固定数值核对",
    },
  });
  const nextVersion = (
    await expectStatus("/api/admin/public-data", 201, {
      method: "POST",
      cookie: adminCookie,
      body: {
        type: "REPORT_TEMPLATE",
        code: "SYN_PUBLIC_TEMPLATE",
        version: "2",
        title: "TEST 新模板版本",
        content: {
          ...template,
          titleSuffix: "第二版报告",
          defaults: { ...template.defaults, purpose: "第二版目的" },
        },
      },
    })
  ).entry;
  await expectStatus(`/api/admin/public-data/${nextVersion.id}/publish`, 200, {
    method: "POST",
    cookie: adminCookie,
  });
  const retained = (await expectStatus(path, 200, { cookie: schoolCookie }))
    .report;
  assert.deepEqual(retained.templateSnapshot, report.templateSnapshot);
  assert.equal(
    retained.revisions[0].contentSnapshot.purpose,
    template.defaults.purpose,
  );
  const preview = `/api/report-revisions/${saved.id}/preview`,
    pdfPath = `/api/report-revisions/${saved.id}/pdf`;
  const exportResponse = await fetch(baseURL + pdfPath, {
    method: "POST",
    headers: { cookie: schoolCookie, origin: baseURL },
  });
  assert.equal(exportResponse.status, 200);
  const pdf = Buffer.from(await exportResponse.arrayBuffer());
  writeFileSync(join(artifacts, "long-title-template.pdf"), pdf);
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const rejected = await db.query(
      'SELECT status FROM "PublicDataVersion" WHERE code LIKE $1',
      ["NEG_%"],
    );
    assert.ok(rejected.rows.every((row) => row.status === "DRAFT"));
    await db.query(
      'UPDATE "FootprintReport" SET "templateSnapshot"=$1 WHERE id=$2',
      [
        JSON.stringify({
          ...retained.templateSnapshot,
          title: "SYN TEST 篡改模板",
        }),
        report.id,
      ],
    );
    try {
      await expectStatus(preview, 409, { cookie: schoolCookie });
      await expectStatus(pdfPath, 409, { cookie: schoolCookie });
    } finally {
      await db.query(
        'UPDATE "FootprintReport" SET "templateSnapshot"=$1 WHERE id=$2',
        [JSON.stringify(retained.templateSnapshot), report.id],
      );
    }
  } finally {
    await db.end();
  }
  for (const [cookie, route] of [
    [schoolCookie, "/accounting/not-a-uuid"],
    [
      schoolBCookie,
      accountingPath.replace("/api/accounting/cases/", "/accounting/"),
    ],
  ]) {
    const response = await fetch(baseURL + route, { headers: { cookie } });
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes("核算案例不存在"));
  }
  const own = (
    await expectStatus("/api/accounting/cases", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: {
        code: "SYN_FIXES_UI",
        product: "TEST 25 年批量录入",
        modelVersionId: production.run.snapshots.modelVersion.id,
      },
    })
  ).case;
  const inputs = {
    ...production.run.snapshots.inputs,
    lines: production.run.snapshots.inputs.lines.map((line) => ({
      ...line,
      factorVersionId: undefined,
    })),
  };
  await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { expectedInputRevision: 1, ruleVersionId: null, inputs },
  });
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
  async function openAs(cookie, route) {
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
    await page.goto(baseURL + route);
  }
  let geometry, titleLineLengths;
  try {
    await openAs(schoolCookie, preview);
    await page.evaluate(() => document.fonts.ready);
    titleLineLengths = await page.locator("h1").evaluate((element) => {
      const lines = new Map();
      const node = element.firstChild;
      for (let i = 0; i < node.textContent.length; i++) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const y = Math.round(range.getBoundingClientRect().top);
        lines.set(y, (lines.get(y) ?? 0) + 1);
      }
      return [...lines.values()];
    });
    assert.ok(
      titleLineLengths.at(-1) > 1,
      "Long title must not end in an isolated character",
    );
    await page.screenshot({
      path: join(artifacts, "long-title-preview.png"),
      fullPage: true,
    });
    await openAs(
      schoolCookie,
      accountingPath.replace("/api/accounting/cases/", "/accounting/"),
    );
    await page.getByLabel("计算运行记录").click();
    await page.getByText(/^修订 v1 · 正式/).click();
    const firstName =
      production.run.snapshots.modelVersion.content.stages[0].categories[0]
        .items[0].dataName;
    await page.getByRole("cell", { name: firstName, exact: true }).waitFor();
    await page
      .getByRole("button", { name: "查看模型、规则、因子和证据", exact: true })
      .click();
    await page.getByText("固定运行来源", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "fixed-run-source.png"),
      fullPage: true,
    });
    await openAs(schoolCookie, `/accounting/${own.id}`);
    await page.getByRole("tab", { name: "运行年度电量", exact: true }).click();
    await page.getByText("25 个年度 / 设计 25 年", { exact: true }).waitFor();
    assert.ok(
      (await page.locator("input").count()) < 150,
      "25 years must not mount 25 annual forms",
    );
    await page
      .getByRole("button", { name: /^移\s*除$/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "批量生成年度", exact: true })
      .click();
    await page
      .getByLabel("第 1 运行年起始日期", { exact: true })
      .fill(inputs.annualEnergy[0].periodStart);
    await page
      .getByLabel("每个缺失年度电量（kWh）", { exact: true })
      .fill("4500");
    await page
      .getByLabel("估算依据", { exact: true })
      .fill("SYN TEST 批量数据");
    await page
      .getByRole("dialog")
      .getByLabel("估算方法", { exact: true })
      .fill("SYN TEST 基准估算");
    await page
      .getByRole("button", { name: "生成估算年度", exact: true })
      .click();
    await page
      .getByText("已补齐缺失年度；现有年度已保留，请核对估算数据后保存", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page
      .getByText("草稿已保存，请对当前输入重新计算", { exact: true })
      .waitFor();
    const stored = (
      await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
        cookie: schoolCookie,
      })
    ).case.revisions[0].inputs;
    assert.equal(stored.annualEnergy.length, 25);
    assert.equal(
      stored.annualEnergy.find((row) => row.operatingYear === 1).value,
      "4500",
    );
    assert.deepEqual(
      stored.annualEnergy.find((row) => row.operatingYear === 2),
      inputs.annualEnergy[1],
    );
    await page
      .getByText("草稿已保存，请对当前输入重新计算", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("tab", { name: "运行年度电量", exact: true })
        .getAttribute("aria-selected"),
      "true",
      "Saving must retain the annual-energy section",
    );
    await page.screenshot({
      path: join(artifacts, "annual-energy-compact.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(artifacts, "mobile-accounting.png"),
      fullPage: true,
    });
    geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      height: document.body.scrollHeight,
    }));
    assert.ok(
      geometry.body <= 390 && geometry.document <= 390,
      JSON.stringify(geometry),
    );
    const current = (
      await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
        cookie: schoolCookie,
      })
    ).case.revisions[0];
    await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: {
        expectedInputRevision: current.inputRevision,
        ruleVersionId: null,
        inputs: {
          ...current.inputs,
          lines: current.inputs.lines.map((line, index) =>
            index === 0 ? { ...line, unit: "吨" } : line,
          ),
        },
      },
    });
    await page.reload();
    await page.getByRole("button", { name: /^试\s*算$/ }).click();
    await page.getByText(/^请选择可换算为 .* 的单位$/).waitFor();
    assert.equal(
      await page
        .getByRole("tab", { name: "生命周期活动数据", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await openAs(reviewerCookie, "/accounting");
    await page.getByText("待审核案例", { exact: true }).waitFor();
    assert.ok(
      (
        await page
          .getByLabel("核算状态")
          .evaluate((element) => element.closest(".ant-select").innerText)
      ).includes("待审核"),
    );
    await page.getByRole("button", { name: "重置筛选", exact: true }).click();
    await page.getByPlaceholder("搜索案例编码或项目名称").fill("SYN_FIXES_UI");
    await page
      .getByRole("link", { name: "SYN_FIXES_UI", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({
      path: join(artifacts, "failure.png"),
      fullPage: true,
    });
    writeFileSync(
      join(artifacts, "failure.txt"),
      await page.locator("body").innerText(),
    );
    console.error("Workflow fixes failure artifacts: " + artifacts);
    throw error;
  } finally {
    await browser.close();
  }
  const result = {
    status: "PASSED",
    checkedAt: new Date().toISOString(),
    artifacts,
    titleLineLengths,
    mobile: geometry,
    pdfSha256: createHash("sha256").update(pdf).digest("hex"),
    browserErrors: errors,
    checks: [
      "不完整规则与非法模板保留草稿",
      "模板选择、默认文案、版本与快照冻结",
      "模板篡改摘要拦截",
      "无效 ID 与跨校页面返回 404",
      "25 年紧凑表格、批量补齐及保存",
      "390 像素页面无横向溢出",
      "审核角色待办与搜索",
      "长标题无孤字行",
    ],
  };
  writeFileSync(
    join(artifacts, "workflow-fixes-result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("Workflow fixes passed: " + artifacts);
  return result;
}
