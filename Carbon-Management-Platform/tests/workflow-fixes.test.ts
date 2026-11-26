import assert from "node:assert/strict";
import test from "node:test";
import {
  energyCsv,
  generateEnergyRows,
  parseEnergyCsv,
  yearPeriod,
  type EnergyRow,
} from "../src/components/accounting/annual-energy-data";
import {
  batchEvidenceTargets,
  planBatchEvidence,
} from "../src/components/accounting/batch-evidence";
import {
  factorApplicabilityProblem,
  factorDateMatch,
  type FactorDetails,
} from "../src/domain/calculation/factor-selection";
import { productionReadiness } from "../src/domain/calculation/production-readiness";
import type { ModelRow } from "../src/domain/calculation/model-rows";
import {
  emptyAccountingInputs,
  MAX_EVIDENCE_ASSETS,
} from "../src/shared/accounting";
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
const activityRows: ModelRow[] = [
  {
    id: "material",
    name: "水泥",
    stage: "RS",
    role: "ACTIVITY",
    unit: "kg",
    modelFactor: "",
  },
  {
    id: "grid",
    name: "输配电",
    stage: "TD",
    role: "GRID_FACTOR",
    unit: "kWh",
    modelFactor: "",
  },
];
const factor: FactorDetails = {
  purpose: "PRODUCTION",
  activityUnit: "kg",
  applicability: {
    stage: "RS",
    subject: "水泥",
    region: "ALL",
    technology: "ALL",
    validFrom: "2024-01-01",
    validTo: "2024-12-31",
  },
};
test("正式计算一次列出规则、因子、活动附件及年度附件缺项", () => {
  const inputs = {
    ...emptyAccountingInputs(),
    referenceDate: "2024-06-01",
    lines: [
      {
        itemId: "material",
        state: "RECORDED" as const,
        activityDate: "2025-01-01",
        factorVersionId: "factor",
        evidenceAssetIds: [],
      },
      { itemId: "grid", state: "RECORDED" as const, evidenceAssetIds: [] },
    ],
    annualEnergy: [{ ...rows[0], evidenceAssetIds: [] }],
  };
  const result = productionReadiness(inputs, {
    rows: activityRows,
    factors: new Map([["factor", factor]]),
  });
  const missing = result.requirements.map((issue) => issue.path);
  for (const path of [
    "ruleVersionId",
    "lines.1.factorVersionId",
    "lines.0.evidenceAssetIds",
    "annualEnergy.0.evidenceAssetIds",
  ])
    assert.ok(missing.includes(path), path);
  assert.ok(!missing.includes("lines.1.evidenceAssetIds"));
  assert.ok(
    result.problems.some(
      (issue) =>
        issue.path === "lines.0.factorVersionId" &&
        issue.code === "FACTOR_EXPIRED",
    ),
  );
});
test("因子日期适用期包含边界，区分未填或无效日期和超期", () => {
  assert.equal(factorDateMatch(factor, "2024-01-01"), "MATCH");
  assert.equal(factorDateMatch(factor, "2024-12-31"), "MATCH");
  assert.equal(factorDateMatch(factor, "2025-01-01"), "OUTSIDE");
  assert.equal(factorDateMatch(factor, "2024-02-30"), "PENDING");
  assert.equal(factorDateMatch(factor, undefined), "PENDING");
  assert.equal(
    factorApplicabilityProblem(factor, {
      stage: "RS",
      unit: "kg",
      subject: "水泥",
      region: "中国",
      technology: "光伏",
      referenceDate: "2024-12-31",
      mode: "PRODUCTION",
    }),
    null,
  );
});
test("批量关联跨活动和年度去重追加，超上限时整批退出", () => {
  const inputs = {
    lines: [
      {
        itemId: "material",
        state: "RECORDED" as const,
        evidenceAssetIds: [asset],
      },
      { itemId: "grid", state: "RECORDED" as const, evidenceAssetIds: [] },
    ],
    annualEnergy: [rows[0]],
  };
  const targets = batchEvidenceTargets(inputs, activityRows);
  const keys = [targets[0].key, targets[2].key];
  assert.deepEqual(planBatchEvidence(targets, keys, [asset]).updates, []);
  const add = planBatchEvidence(targets, keys, ["new", "new", asset]);
  assert.equal(add.error, null);
  assert.deepEqual(
    add.updates.map((item) => [item.section, item.assetIds]),
    [
      ["lines", [asset, "new"]],
      ["annualEnergy", [asset, "new"]],
    ],
  );
  assert.equal(inputs.lines[1].evidenceAssetIds.length, 0);
  assert.deepEqual(inputs.annualEnergy[0].evidenceAssetIds, [asset]);
  const full = batchEvidenceTargets(
    {
      ...inputs,
      annualEnergy: [
        {
          ...rows[0],
          evidenceAssetIds: Array.from(
            { length: MAX_EVIDENCE_ASSETS },
            (_, i) => String(i),
          ),
        },
      ],
    },
    activityRows,
  );
  const rejected = planBatchEvidence(full, keys, ["new"]);
  assert.match(rejected.error ?? "", /上限/);
  assert.deepEqual(rejected.updates, []);
});
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
