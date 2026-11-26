import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyPvAcceptance } from "../src/domain/acceptance/pv";
import {
  parseReportSource,
  reportRunSnapshotSchema,
  isDemonstrationSnapshot,
} from "../src/domain/reports/snapshot";
import {
  buildReportDocument,
  defaultReportContent,
} from "../src/domain/reports/document";
import { renderReportHtml } from "../src/domain/reports/template";
import {
  createReportSchema,
  REPORT_TEMPLATE_VERSION,
  saveReportSchema,
  reportContentIssues,
} from "../src/shared/reports";

function sourceFixture() {
  const bundle = JSON.parse(
    readFileSync("tests/fixtures/pv-acceptance-reference.json", "utf8"),
  );
  const calculated = verifyPvAcceptance(bundle);
  assert.ok(calculated.result);
  return parseReportSource({
    schemaVersion: 1,
    school: { id: bundle.schoolId, name: "TEST 学校" },
    accountingCase: {
      id: "00000000-0000-4000-8000-000000000500",
      code: "DEMO_SOURCE",
      product: "光伏测试",
      revisionNo: 2,
    },
    run: {
      id: "00000000-0000-4000-8000-000000000501",
      inputRevision: 1,
      inputHash: "a".repeat(64),
      createdAt: "2026-10-07T12:00:00.000Z",
    },
    accountingReview: {
      actorName: "TEST 复核人",
      reason: "测试审核",
      reviewedAt: "2026-10-07T13:00:00.000Z",
    },
    snapshot: { ...bundle.snapshot, mode: "PRODUCTION" },
    result: { ...calculated.result, mode: "PRODUCTION" },
    demonstration: true,
  });
}
const meta = {
  code: "TEST_REPORT",
  revisionNo: 1,
  templateVersion: "pv-report-1.0.0",
  status: "APPROVED" as const,
  contentHash: "b".repeat(64),
  reviewerName: "TEST reviewer",
  reviewReason: "测试通过",
  reviewedAt: "2026-10-07T14:00:00.000Z",
};

test("T07: drafts may be incomplete; submission identifies missing fields", () => {
  const source = sourceFixture();
  const content = defaultReportContent(source, "TEST writer");
  assert.deepEqual(reportContentIssues(content), [
    "报告日期为必填项",
    "结果分析与结论为必填项",
  ]);
  assert.equal(
    saveReportSchema.safeParse({
      revisionId: source.run.id,
      expectedContentRevision: 1,
      content,
    }).success,
    true,
  );
  content.reportingDate = "2026-10-07";
  content.conclusion = "测试结果";
  assert.deepEqual(reportContentIssues(content), []);
});

test("T07: API contracts refuse numeric/source rewrites and invalid dates", () => {
  const source = sourceFixture();
  const content = defaultReportContent(source, "TEST");
  assert.equal(
    saveReportSchema.safeParse({
      revisionId: source.run.id,
      expectedContentRevision: 1,
      content: { ...content, result: { footprintKgPerKwh: "0" } },
    }).success,
    false,
  );
  assert.equal(
    saveReportSchema.safeParse({
      revisionId: source.run.id,
      expectedContentRevision: 1,
      content,
      sourceSnapshot: source,
    }).success,
    false,
  );
  assert.equal(
    saveReportSchema.safeParse({
      revisionId: source.run.id,
      expectedContentRevision: 1,
      content: { ...content, reportingDate: "2026-02-30" },
    }).success,
    false,
  );
  assert.equal(
    createReportSchema.safeParse({
      code: "TEST_REPORT",
      calculationRunId: source.run.id,
      schoolId: source.school.id,
    }).success,
    false,
  );
});

test("T07: structured report retains independent expected display and raw values", () => {
  const source = sourceFixture();
  const document = buildReportDocument(
    meta,
    defaultReportContent(source, "TEST"),
    source,
  );
  const summary = document.tables[0].rows;
  assert.deepEqual(
    summary.find((row) => row[0] === "排放总量"),
    ["排放总量", "3688.90", "kgCO₂e"],
  );
  assert.deepEqual(
    summary.find((row) => row[0] === "单位电量碳足迹"),
    ["单位电量碳足迹", "0.038831", "kgCO₂e/kWh"],
  );
  assert.ok(
    document.tables
      .at(-1)
      ?.rows.some((row) => row[1] === source.result.footprintKgPerKwh),
  );
  const html = renderReportHtml(document);
  for (const value of Object.values(source.result.display.stagesKg))
    assert.ok(html.includes(value));
  assert.ok(html.includes(source.run.id));
  assert.ok(html.includes("DEMO / TEST"));
});

test("T07: subprecision positive results carry the same less-than marker in HTML", () => {
  const source = sourceFixture();
  source.result.display.totalEmissionsKg = "0.00";
  source.result.display.totalBelowDisplayPrecision = true;
  source.result.display.footprintKgPerKwh = "0.000000";
  source.result.display.belowDisplayPrecision = true;
  const html = renderReportHtml(
    buildReportDocument(meta, defaultReportContent(source, "TEST"), source),
  );
  assert.ok(html.includes("&lt; 0.01"));
  assert.ok(html.includes("&lt; 0.000001"));
});

test("T07: HTML escapes editable text and historical source is detached from mutable input", () => {
  const raw = sourceFixture();
  const source = parseReportSource(raw);
  raw.snapshot.inputs.lines[0].value = "999999";
  assert.notEqual(
    source.snapshot.inputs.lines[0].value,
    raw.snapshot.inputs.lines[0].value,
  );
  const content = defaultReportContent(source, "TEST");
  content.title = '<img src="https://example.invalid" onerror="alert(1)">';
  content.conclusion = "<script>alert(1)</script> & 结论";
  const html = renderReportHtml(buildReportDocument(meta, content, source));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('<img src="https://'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp; 结论"));
});

test("T07: reports show Beijing review time with precision set by the template version", () => {
  const source = sourceFixture();
  const content = defaultReportContent(source, "TEST");
  const current = buildReportDocument(
    { ...meta, templateVersion: REPORT_TEMPLATE_VERSION },
    content,
    source,
  );
  assert.ok(
    current.tables[0].rows.some(
      (row) => row[0] === "输配电后电量（足迹分母）" && row[1] === "95000",
    ),
  );
  assert.ok(current.reviewNote.includes("2026/10/07 22:00"));
  assert.ok(
    current.metadata.some(
      ([label, value]) =>
        label === "核算复核" && value.includes("2026/10/07 21:00"),
    ),
  );
  assert.ok(renderReportHtml(current).includes(".appendix{margin-top:8mm}"));
  const legacy = buildReportDocument(meta, content, source);
  assert.ok(legacy.reviewNote.includes(" / 2026/10/07 / "));
  assert.ok(
    !legacy.tables[0].rows.some((row) => row[0] === "输配电后电量（足迹分母）"),
  );
  assert.ok(renderReportHtml(legacy).includes(".appendix{break-before:page}"));
});

test("T07: unused fallback TEST factors do not turn a production report into a demo", () => {
  const original = sourceFixture().snapshot;
  const raw = JSON.parse(
    JSON.stringify(original).replace(/DEMO|SYN|TEST|演示|构造/g, "正式"),
  );
  raw.ruleVersion.content.purpose = "PRODUCTION";
  for (const factor of raw.factors) factor.content.purpose = "PRODUCTION";
  const snapshot = reportRunSnapshotSchema.parse(raw);
  const unused = structuredClone(snapshot.factors[0]);
  unused.id = "00000000-0000-4000-8000-000000000999";
  unused.content.purpose = "TEST";
  snapshot.factors.push(unused);
  assert.equal(isDemonstrationSnapshot("PV_SITE_001", snapshot), false);
  const businessSource = sourceFixture();
  businessSource.demonstration = false;
  const businessContent = defaultReportContent(businessSource, "编制人");
  assert.equal(businessContent.dataQuality, "");
  assert.ok(
    reportContentIssues(businessContent).includes("数据质量与来源说明为必填项"),
  );
  snapshot.factors[0].content.purpose = "TEST";
  assert.equal(isDemonstrationSnapshot("PV_SITE_001", snapshot), true);
});

test("T07: 1.0.1 retains delivered-energy semantics while only 1.0.2 balances titles", () => {
  const source = sourceFixture();
  const content = defaultReportContent(source, "TEST");
  const previous = buildReportDocument(
    { ...meta, templateVersion: "pv-report-1.0.1" },
    content,
    source,
  );
  const latest = buildReportDocument(
    { ...meta, templateVersion: REPORT_TEMPLATE_VERSION },
    content,
    source,
  );
  assert.deepEqual(previous.tables, latest.tables);
  assert.ok(!renderReportHtml(previous).includes("text-wrap:balance"));
  assert.ok(renderReportHtml(latest).includes("text-wrap:balance"));
});
