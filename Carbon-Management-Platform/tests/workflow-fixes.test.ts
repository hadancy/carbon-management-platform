import assert from "node:assert/strict";
import test from "node:test";
import {
  energyCsv,
  generateEnergyRows,
  parseEnergyCsv,
  yearPeriod,
  type EnergyRow,
} from "../src/components/accounting/annual-energy-data";
import { compatibleUnitOptions, canConvertUnit } from "../src/shared/units";
import { pvRuleSchema } from "../src/shared/calculation-rule";
import {
  publicReportTemplateSchema,
  applyReportTemplate,
} from "../src/shared/report-template";
import { REPORT_TEMPLATE_VERSION } from "../src/shared/reports";
const asset = "00000000-0000-4000-8000-000000000001";
const base = {
  source: "ESTIMATED" as const,
  value: "100000",
  unit: "kWh",
  evidence: '测试凭证，含 "引号"\n与换行',
  method: "相同基准估算",
  evidenceAssetIds: [asset],
};
const rows = generateEnergyRows(25, "2024-01-01", base, []);
test("年度批量生成保留已有实测数据、完整闰年和附件", () => {
  const actual = {
    ...rows[0],
    source: "ACTUAL" as const,
    value: "98765",
    method: "",
  };
  const result = generateEnergyRows(25, "2024-01-01", base, [actual]);
  assert.equal(result.length, 25);
  assert.deepEqual(result[0], actual);
  assert.deepEqual(yearPeriod("2024-01-01", 0), {
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
  });
  assert.throws(() => yearPeriod("2024-02-29", 0));
  assert.throws(() => yearPeriod("2024-02-30", 0));
});
test("CSV 引号与多行往返、局部导入保留未导入年度和证据", () => {
  const edited = { ...rows[0], value: "12345" };
  const result = parseEnergyCsv(energyCsv([edited]), 25, rows);
  assert.equal(result.imported, 1);
  assert.equal(result.replaced, 1);
  assert.equal(result.rows.length, 25);
  assert.deepEqual(result.rows[0], edited);
  assert.deepEqual(result.rows[24], rows[24]);
  assert.deepEqual(parseEnergyCsv(energyCsv(rows), 25, rows).rows, rows);
});
test("CSV 拒绝重复年份、部分运行年、非法单位、负数、缺少凭证和破损格式", () => {
  assert.throws(
    () => parseEnergyCsv(energyCsv([rows[0], rows[0]]), 25, rows),
    /重复/,
  );
  for (const patch of [
    { periodEnd: "2024-06-30" },
    { unit: "吨" },
    { value: "-1" },
    { evidence: "" },
    { method: "" },
  ])
    assert.throws(() =>
      parseEnergyCsv(
        energyCsv([{ ...rows[0], ...patch } as EnergyRow]),
        25,
        rows,
      ),
    );
  assert.throws(() => parseEnergyCsv('"运行年', 25, rows), /未闭合/);
});
test("单位选择与计算内核保持相同兼容维度", () => {
  assert.deepEqual(
    compatibleUnitOptions("t").map((item) => item.value),
    ["g", "kg", "t"],
  );
  assert.equal(canConvertUnit("吨", "t"), false);
  assert.equal(canConvertUnit("kWh", "t"), false);
  assert.equal(canConvertUnit("kg", "t"), true);
});
test("规则发布契约拒绝旧描述对象、未知方法及倒置有效期", () => {
  assert.equal(
    pvRuleSchema.safeParse({ description: "故意省略用途、公式与期间" }).success,
    false,
  );
  const rule = {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    formula: "PV_GRID_V1",
    purpose: "PRODUCTION",
    standardReference: "TEST",
    effectiveFrom: "2020-01-01",
    effectiveTo: "2060-12-31",
    approvalReference: "TEST",
  };
  assert.equal(pvRuleSchema.safeParse(rule).success, true);
  assert.equal(
    pvRuleSchema.safeParse({ ...rule, formula: "UNCONFIRMED" }).success,
    false,
  );
  assert.equal(
    pvRuleSchema.safeParse({ ...rule, effectiveTo: "2019-12-31" }).success,
    false,
  );
});
test("公共报告模板只能配置文案；不接受数值、HTML 版式或不完整结构", () => {
  const template = {
    schemaVersion: 1,
    product: "PV",
    scenario: "GRID_ONLY",
    layoutVersion: REPORT_TEMPLATE_VERSION,
    purpose: "TEST",
    approvalReference: "TEST 确认依据",
    titleSuffix: "测试报告",
    preparedBy: "测试机构",
    defaults: {
      purpose: "模板目的",
      methodology: "",
      dataQuality: "",
      conclusion: "",
      limitations: "",
    },
  };
  assert.equal(publicReportTemplateSchema.safeParse(template).success, true);
  assert.equal(
    publicReportTemplateSchema.safeParse({
      ...template,
      result: { totalEmissionsKg: "0" },
    }).success,
    false,
  );
  assert.equal(
    publicReportTemplateSchema.safeParse({
      ...template,
      layoutVersion: "<html>",
    }).success,
    false,
  );
  assert.equal(
    publicReportTemplateSchema.safeParse({ ...template, approvalReference: "" })
      .success,
    false,
  );
  const content = applyReportTemplate(
    {
      title: "原标题",
      preparedBy: "创建人",
      reportingDate: "",
      purpose: "原目的",
      methodology: "原方法",
      dataQuality: "原数据",
      conclusion: "",
      limitations: "原限制",
    },
    "测试项目",
    publicReportTemplateSchema.parse(template),
  );
  assert.equal(content.title, "测试项目测试报告");
  assert.equal(content.purpose, "模板目的");
  assert.equal(content.methodology, "原方法");
});
