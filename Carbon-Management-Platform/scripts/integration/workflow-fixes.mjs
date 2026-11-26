import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
    lines: production.run.snapshots.inputs.lines.map((line, index) => ({
      ...line,
      factorVersionId: undefined,
      evidenceAssetIds: index === 0 ? [] : line.evidenceAssetIds,
    })),
  };
  await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { expectedInputRevision: 1, ruleVersionId: null, inputs },
  });
  const draftDb = new pg.Client({ connectionString: databaseUrl });
  await draftDb.connect();
  try {
    const legacyDraft = await draftDb.query(
      `UPDATE "AccountingRevision"
       SET inputs = inputs #- '{annualEnergy,2,evidenceAssetIds}'
       WHERE id = $1`,
      [own.currentRevisionId],
    );
    assert.equal(legacyDraft.rowCount, 1);
  } finally {
    await draftDb.end();
  }
  const blocked = await expectStatus(
    `/api/accounting/cases/${own.id}/runs`,
    400,
    {
      method: "POST",
      cookie: schoolCookie,
      body: { requestId: randomUUID(), mode: "PRODUCTION" },
    },
  );
  assert.equal(blocked.run, null);
  for (const path of [
    "ruleVersionId",
    "lines.0.factorVersionId",
    "lines.0.evidenceAssetIds",
    "annualEnergy.2.evidenceAssetIds",
  ])
    assert.ok(
      blocked.diagnostics.some((problem) => problem.path === path),
      path,
    );
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
    const checklist = page.getByRole("dialog", { name: /^正式计算检查/ });
    const inspect = page.getByRole("button", { name: /^正式计算检查/ });
    await page.getByRole("button", { name: "正式计算", exact: true }).click();
    await checklist
      .getByRole("button", { name: "规则版本", exact: true })
      .waitFor();
    await checklist
      .getByRole("button", { name: /公用因子版本/ })
      .first()
      .waitFor();
    await checklist
      .getByRole("button", { name: /证据附件/ })
      .first()
      .waitFor();
    await checklist
      .getByRole("button", { name: /^运输 .*公用因子版本$/ })
      .click();
    await checklist.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.id === "lines_1_factorVersionId",
    );
    const activities = page.getByRole("tabpanel", {
      name: "生命周期活动数据",
      exact: true,
    });
    const materials = activities.getByRole("tab", { name: /^原材料及设备/ });
    const transport = activities.getByRole("tab", { name: /^运输/ });
    const materialValue = page.locator("#lines_0_value");
    assert.equal(await transport.getAttribute("aria-selected"), "true");
    assert.equal(await materialValue.isVisible(), false);
    await materials.click();
    await materialValue.fill("123.456");
    await transport.click();
    await page.locator("#lines_1_weight").waitFor();
    assert.equal(await materialValue.isVisible(), false);
    await materials.click();
    await materialValue.waitFor();
    assert.equal(await materialValue.inputValue(), "123.456");
    await materialValue.fill(inputs.lines[0].value);
    await transport.click();
    const factorPicker = page.locator("#lines_1_factorVersionId");
    const candidates = page.locator(".ant-select-dropdown:visible");
    await factorPicker.click();
    await candidates.getByText("日期匹配", { exact: true }).first().waitFor();
    await candidates
      .getByText(/^适用期 \d{4}-\d{2}-\d{2} 至 /)
      .first()
      .waitFor();
    await factorPicker.press("Escape");
    const activityDate = page.locator("#lines_1_activityDate");
    await activityDate.fill("1901-01-01");
    await activityDate.press("Tab");
    await factorPicker.click();
    await candidates
      .getByText("日期超出适用期", { exact: true })
      .first()
      .waitFor();
    await factorPicker.press("Escape");
    await activityDate.fill(inputs.lines[1].activityDate);
    await activityDate.press("Tab");

    await inspect.click();
    await checklist
      .getByRole("button", { name: "运行年度 3 / 证据附件", exact: true })
      .click();
    await checklist.waitFor({ state: "hidden" });
    const yearDialog = page.getByRole("dialog", { name: "编辑运行年度" });
    await yearDialog.getByLabel("证据附件", { exact: true }).waitFor();
    await page.waitForFunction(
      () => document.activeElement?.id === "evidenceAssetIds",
    );
    await yearDialog.getByRole("button", { name: /^取\s*消$/ }).click();
    await yearDialog.waitFor({ state: "hidden" });
    await inspect.click();
    await checklist
      .getByRole("button", { name: "规则版本", exact: true })
      .click();
    await checklist.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.id === "ruleVersionId",
    );

    await page.getByRole("tab", { name: "运行年度电量", exact: true }).click();
    await page.getByText("25 个年度 / 设计 25 年", { exact: true }).waitFor();
    assert.ok(
      (await page.locator("input").count()) < 150,
      "25 years must not mount 25 annual forms",
    );
    const editYear = page.getByRole("button", { name: /^编\s*辑$/ });
    const applyYear = yearDialog.getByRole("button", { name: "应用到草稿" });
    await editYear.nth(2).click();
    await yearDialog.getByLabel("上网电量", { exact: true }).fill("4100");
    await applyYear.click();
    await yearDialog.waitFor({ state: "hidden" });
    await page.getByRole("cell", { name: "4100 kWh", exact: true }).waitFor();
    await editYear.nth(1).click();
    await yearDialog.getByRole("button", { name: "移除引用" }).waitFor();
    await applyYear.click();
    await yearDialog.waitFor({ state: "hidden" });
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
    assert.deepEqual(
      stored.annualEnergy.find((row) => row.operatingYear === 3),
      { ...inputs.annualEnergy[2], value: "4100", evidenceAssetIds: [] },
    );
    await page
      .getByText("草稿已保存，请对当前输入重新计算", { exact: true })
      .waitFor({ state: "hidden" });
    const sharedAsset = production.run.snapshots.assets.find(
      (item) => item.id === inputs.annualEnergy[1].evidenceAssetIds[0],
    );
    assert.ok(sharedAsset);
    await page
      .getByRole("button", { name: "批量关联凭证", exact: true })
      .click();
    const batch = page.getByRole("dialog", {
      name: "批量关联凭证",
      exact: true,
    });
    const targets = batch.getByLabel("关联记录", { exact: true });
    await targets.click();
    await candidates
      .locator(".ant-select-item-option-content")
      .filter({ hasText: `原材料及设备 / ${firstName}` })
      .click();
    await targets.fill("第 3 运行年");
    await candidates
      .locator(".ant-select-item-option-content")
      .filter({ hasText: /^第 3 运行年（/ })
      .click();
    await targets.press("Escape");
    await batch.getByLabel("共用凭证", { exact: true }).click();
    await page
      .locator(".ant-select-dropdown:visible")
      .getByText(sharedAsset.name, { exact: true })
      .filter({ visible: true })
      .click();
    await batch
      .getByRole("button", { name: "关联到所选记录", exact: true })
      .click();
    await page
      .getByText("已关联到 2 条记录，请保存草稿", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: /保存草稿$/ }).click();
    await page
      .getByText("草稿已保存，请对当前输入重新计算", { exact: true })
      .waitFor();
    const afterBatch = (
      await expectStatus(`/api/accounting/cases/${own.id}`, 200, {
        cookie: schoolCookie,
      })
    ).case.revisions[0].inputs;
    assert.deepEqual(afterBatch.lines[0].evidenceAssetIds, [sharedAsset.id]);
    assert.deepEqual(
      afterBatch.annualEnergy.find((row) => row.operatingYear === 3)
        .evidenceAssetIds,
      [sharedAsset.id],
    );
    assert.deepEqual(
      afterBatch.annualEnergy.find((row) => row.operatingYear === 2),
      inputs.annualEnergy[1],
    );
    assert.equal(
      await page
        .getByRole("tab", { name: "运行年度电量", exact: true })
        .getAttribute("aria-selected"),
      "true",
      "Saving must retain the annual-energy section",
    );
    assert.equal(
      new URL(page.url()).searchParams.get("activity"),
      inputs.lines[1].itemId,
      "Saving must retain the selected activity",
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
    await page.waitForFunction(
      () => document.activeElement?.id === "lines_0_unit",
    );
    assert.equal(await materials.getAttribute("aria-selected"), "true");
    assert.equal(
      await page
        .getByRole("tab", { name: "生命周期活动数据", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await openAs(reviewerCookie, "/accounting");
    const statusSelect = page
      .locator(".ant-select")
      .filter({ has: page.getByLabel("核算状态") });
    const draftCase = page.getByRole("link", {
      name: "SYN_FIXES_UI",
      exact: true,
    });
    await statusSelect.getByText("全部状态", { exact: true }).waitFor();
    await draftCase.waitFor();
    await page.getByRole("button", { name: "待审核案例", exact: true }).click();
    await statusSelect.getByText("待审核", { exact: true }).waitFor();
    await draftCase.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "重置筛选", exact: true }).click();
    await statusSelect.getByText("全部状态", { exact: true }).waitFor();
    await draftCase.waitFor();
    await page.getByPlaceholder("搜索案例编码或项目名称").fill("SYN_FIXES_UI");
    await draftCase.waitFor();
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
      "缺少附件列表的年度可保存，已有附件保留",
      "活动按阶段切换、草稿保留和试算缺项定位",
      "正式计算缺项同时返回并能跳转，因子匹配随活动日期更新，活动与年度可批量关联凭证",
      "390 像素页面无横向溢出",
      "审核角色默认全部状态、待审核筛选与搜索",
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
