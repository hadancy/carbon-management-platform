import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePv,
  type PvCalculationInput,
} from "../src/domain/calculation/pv";
import { estimateAnnualEnergy } from "../src/domain/calculation/energy";
import { convertUnit } from "../src/domain/calculation/units";
import {
  displayDecimal,
  Exact,
  parseNonnegative,
  percentToRatio,
} from "../src/domain/calculation/decimal";
import {
  calculationFactorSchema,
  copyLegacyFactorToV2Draft,
} from "../src/shared/emission-factors";
import { modelContentSchema } from "../src/shared/models";
import { validatePvCalculationProfile } from "../src/shared/calculation-profile";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stages = ["RS", "TR", "CS", "US", "TD"] as const;
const units = ["kg", "t_km", "kWh", "kWh", "kWh"];
const names = ["材料", "运输", "施工电力", "运行电力", "输配电"];
const values = ["2", "0.1", "0.5", "0.5", "0.0046"];

function factor(index: number) {
  const content = calculationFactorSchema.parse({
    schemaVersion: 2,
    purpose: "TEST",
    value: values[index],
    activityUnit: units[index],
    emissionUnit: "kgCO2e",
    note: "合成测试因子",
    applicability: {
      product: "PV",
      stage: stages[index],
      subject: names[index],
      region: "ALL",
      technology: "ALL",
      validFrom: "2020-01-01",
      validTo: "2035-12-31",
      dataYear: 2024,
      boundary: "合成测试边界",
    },
    evidence: {
      sourceCategory: "OTHER",
      issuer: "测试",
      reference: "SYN-PV-001",
      publishedAt: "2024-01-01",
      originalValue: values[index],
      conversion: "不换算",
      license: "仅工程测试",
    },
    governance: {
      basis: "SYN-PV-001",
      changeReason: "初版测试",
      supersedesVersionId: null,
    },
  });
  return {
    id: id(100 + index),
    code: `SYN_${stages[index]}`,
    version: "1",
    type: "EMISSION_FACTOR" as const,
    status: "PUBLISHED" as const,
    content,
  };
}

function fixture(): PvCalculationInput {
  const content = modelContentSchema.parse({
    name: "合成光伏模型",
    functionalQuantity: 1,
    functionalUnit: "kWh",
    functionalDescription: "1 kWh",
    boundary: "合成五阶段",
    boundaryDiagram: "",
    referenceStandard: "SYN-PV-001",
    description: "仅测试",
    stages: stages.map((stage, index) => ({
      id: id(index + 1),
      name: names[index],
      categories: [
        {
          id: id(index + 11),
          name: "测试",
          items: [
            {
              id: id(index + 21),
              dataName: names[index],
              specModel: "",
              manufacturer: "",
              carbonFootprintFactor: "",
              functionalUnit: units[index],
              emissionFactor: "",
              factorSource: "",
              dataSource: "",
            },
          ],
        },
      ],
    })),
    calculationProfile: {
      product: "PV",
      formula: "PV_GRID_V1",
      stageMappings: stages.map((stage, index) => ({
        stageId: id(index + 1),
        calculationStage: stage,
      })),
      itemMappings: stages.map((stage, index) => ({
        itemId: id(index + 21),
        role:
          stage === "TR"
            ? "TRANSPORT"
            : stage === "TD"
              ? "GRID_FACTOR"
              : "ACTIVITY",
        factorActivityUnit: units[index],
      })),
    },
  });
  return {
    mode: "TRIAL",
    scenario: "GRID_ONLY",
    model: { id: id(200), scope: "SCHOOL", status: "PUBLISHED", content },
    factors: stages.map((_, index) => factor(index)),
    referenceDate: "2026-09-29",
    region: "中国",
    technology: "光伏",
    operatingYears: 25,
    annualEnergy: Array.from({ length: 25 }, (_, index) => ({
      operatingYear: index + 1,
      periodStart: `${2026 + index}-01-01`,
      periodEnd: `${2026 + index}-12-31`,
      source: "ESTIMATED",
      value: "4000",
      unit: "kWh",
      evidence: "合成数据",
      method: "测试固定值",
    })),
    directSupplyKwh: "0",
    lossRatio: "0.05",
    transmissionMethod: "GRID_FACTOR_FALLBACK",
    transmissionFallbackReason: "合成场景假定 SF₆ 数据不可取得",
    lines: [
      {
        itemId: id(21),
        state: "RECORDED",
        value: "2000",
        unit: "kg",
        factorVersionId: id(100),
        activityDate: "2026-09-29",
        evidence: "合成",
      },
      {
        itemId: id(22),
        state: "RECORDED",
        weight: "2",
        weightUnit: "t",
        distance: "100",
        distanceUnit: "km",
        factorVersionId: id(101),
        activityDate: "2026-09-29",
        evidence: "合成",
      },
      {
        itemId: id(23),
        state: "RECORDED",
        value: "1000",
        unit: "kWh",
        factorVersionId: id(102),
        activityDate: "2026-09-29",
        evidence: "合成",
      },
      {
        itemId: id(24),
        state: "RECORDED",
        value: "2000",
        unit: "kWh",
        factorVersionId: id(103),
        activityDate: "2026-09-29",
        evidence: "合成",
      },
      { itemId: id(25), state: "RECORDED", factorVersionId: id(104) },
    ],
  };
}

function failure(input: PvCalculationInput) {
  const result = calculatePv(input);
  assert.equal(result.ok, false);
  return result.diagnostics;
}

test("E01: SYN-PV-001 yields all five stages, total, and rounded display", () => {
  const calculated = calculatePv(fixture());
  assert.equal(calculated.ok, true);
  if (!calculated.ok) return;
  assert.deepEqual(calculated.result.stagesKg, {
    RS: "4000",
    TR: "20",
    CS: "500",
    US: "1000",
    TD: "460",
  });
  assert.equal(calculated.result.totalEmissionsKg, "5980");
  assert.equal(calculated.result.gridEnergyKwh, "100000");
  assert.equal(calculated.result.deliveredEnergyKwh, "95000");
  assert.ok(
    new Exact(calculated.result.footprintKgPerKwh)
      .minus(new Exact("5980").div("95000"))
      .abs()
      .lte("0.000000000001"),
  );
  assert.equal(calculated.result.display.footprintKgPerKwh, "0.062947");
  assert.equal(calculated.result.display.stagesBelowDisplayPrecision.RS, false);
  assert.equal(calculated.result.lines[4].normalizedActivity, "100000");
});

test("E02: mass conversion preserves emissions; incompatible units are rejected", () => {
  const input = fixture();
  input.lines[0].value = "2";
  input.lines[0].unit = "t";
  const calculated = calculatePv(input);
  assert.equal(calculated.ok, true);
  if (calculated.ok) {
    assert.equal(calculated.result.stagesKg.RS, "4000");
    assert.equal(calculated.result.lines[0].conversions[0].multiplier, "1000");
  }
  assert.equal(convertUnit("1", "kW", "kWh"), null);
  assert.equal(convertUnit("1", "块", "台"), null);
  input.lines[0].unit = "kWh";
  assert.ok(failure(input).some((issue) => issue.code === "INVALID_ACTIVITY"));
});

test("E03-E04: missing, zero, invalid numbers and denominator return diagnostics", () => {
  const input = fixture();
  delete input.lines[0].value;
  assert.ok(failure(input).some((issue) => issue.path === "lines.0.value"));
  input.lines[0].value = "0";
  assert.ok(failure(input).some((issue) => issue.code === "ZERO_REASON"));
  input.lines[0].reason = "实际无材料";
  assert.equal(calculatePv(input).ok, true);
  input.lines[0].value = "NaN";
  assert.ok(failure(input).some((issue) => issue.code === "INVALID_ACTIVITY"));
  input.lines[0].value = "-1";
  assert.ok(failure(input).some((issue) => issue.code === "INVALID_ACTIVITY"));
  input.lines[0].value = "1e2";
  assert.ok(failure(input).some((issue) => issue.code === "INVALID_ACTIVITY"));
  input.lines[0].value = "2000";
  input.lossRatio = "1";
  assert.ok(
    failure(input).some((issue) => issue.code === "INVALID_LOSS_RATIO"),
  );
  input.lossRatio = "0.05";
  input.annualEnergy = input.annualEnergy.map((entry) => ({
    ...entry,
    value: "0",
  }));
  assert.ok(failure(input).some((issue) => issue.code === "ZERO_GRID_ENERGY"));
});

test("E05-E07: disabled direct supply, annual estimation and coverage", () => {
  const input = fixture();
  input.scenario = "DIRECT_ONLY";
  input.annualEnergy = input.annualEnergy.map((entry) => ({
    ...entry,
    value: "0",
  }));
  input.directSupplyKwh = "100000";
  assert.deepEqual(
    failure(input).map((issue) => issue.code),
    ["SCENARIO_DISABLED"],
  );
  const estimated = estimateAnnualEnergy({
    operatingYears: 3,
    firstPeriodStart: "2026-01-01",
    actual: [
      {
        operatingYear: 1,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        source: "ACTUAL",
        value: "750",
        unit: "kWh",
        evidence: "实测",
      },
    ],
    capacityKw: "100",
    fullLoadHours: "10",
    performanceRatio: "0.8",
    degradationRate: "0.1",
    baseIncludesFirstYearDegradation: false,
    method: "固定衰减",
    evidence: "合成",
  });
  assert.equal(estimated.ok, true);
  if (estimated.ok) {
    assert.deepEqual(
      estimated.entries.map((entry) => entry.value),
      ["750", "648", "583.2"],
    );
    assert.equal(estimated.totalKwh, "1981.2");
  }
  assert.equal(
    estimateAnnualEnergy({
      operatingYears: 3,
      firstPeriodStart: "2026-01-01",
      actual: [],
      capacityKw: "100",
      fullLoadHours: "10",
      performanceRatio: "0.8",
      degradationRate: "0.1",
      baseIncludesFirstYearDegradation: true,
      method: "固定衰减",
      evidence: "合成",
    }).ok,
    false,
  );
  input.scenario = "GRID_ONLY";
  input.directSupplyKwh = "0";
  input.annualEnergy = fixture().annualEnergy;
  input.annualEnergy[1].operatingYear = 1;
  assert.ok(failure(input).some((issue) => issue.code === "DUPLICATE_YEAR"));
  assert.ok(failure(input).some((issue) => issue.code === "MISSING_YEAR"));
  input.annualEnergy = fixture().annualEnergy;
  input.annualEnergy[0].periodEnd = "2026-11-30";
  assert.ok(failure(input).some((issue) => issue.code === "PARTIAL_YEAR"));
  assert.ok(failure(input).some((issue) => issue.code === "PERIOD_GAP"));
});

test("T01-T02: decimal strings, ratio, v2 factor eligibility and model mapping", () => {
  assert.equal(
    parseNonnegative("999999999999999999.123456789012345678")?.toString(),
    "999999999999999999.123456789012345678",
  );
  assert.equal(parseNonnegative("1000000000000000000"), null);
  assert.equal(parseNonnegative("0.1234567890123456789"), null);
  assert.equal(percentToRatio("5"), "0.05");
  assert.deepEqual(displayDecimal(new Exact("0.00000001"), 6), {
    value: "0.000000",
    belowDisplayPrecision: true,
  });
  const tiny = fixture();
  tiny.factors[1].content = { ...factor(1).content, value: "0.000001" };
  const tinyResult = calculatePv(tiny);
  assert.equal(tinyResult.ok, true);
  if (tinyResult.ok) {
    assert.equal(tinyResult.result.display.stagesKg.TR, "0.00");
    assert.equal(
      tinyResult.result.display.stagesBelowDisplayPrecision.TR,
      true,
    );
  }
  const input = fixture();
  assert.equal(validatePvCalculationProfile(input.model.content), null);
  input.factors[0].content = {
    value: "2",
    activityUnit: "kg",
    emissionUnit: "kgCO2e",
  };
  assert.ok(failure(input).some((issue) => issue.code === "LEGACY_FACTOR"));
  const upgraded = copyLegacyFactorToV2Draft(input.factors[0].content, {
    purpose: "TEST",
    applicability: factor(0).content.applicability,
    evidence: factor(0).content.evidence,
    governance: factor(0).content.governance,
  });
  assert.equal(upgraded?.schemaVersion, 2);
  input.factors[0].content = factor(0).content;
  input.factors[0].retiredAt = "2026-01-01";
  assert.ok(failure(input).some((issue) => issue.code === "INACTIVE_FACTOR"));
  delete input.factors[0].retiredAt;
  input.region = "EU";
  input.factors[0].content = {
    ...factor(0).content,
    applicability: { ...factor(0).content.applicability, region: "CN" },
  };
  assert.ok(failure(input).some((issue) => issue.code === "FACTOR_SCOPE"));
  input.factors[0].content = factor(0).content;
  input.lines[0].activityDate = "2026-99-99";
  assert.ok(
    failure(input).some((issue) => issue.code === "MISSING_ACTIVITY_DATE"),
  );
  input.lines[0].activityDate = "2036-01-01";
  assert.ok(failure(input).some((issue) => issue.code === "FACTOR_EXPIRED"));
  input.lines[0].activityDate = "2026-09-29";
  input.mode = "PRODUCTION";
  assert.ok(failure(input).some((issue) => issue.code === "TEST_FACTOR"));
  input.model.content.calculationProfile = undefined;
  assert.ok(
    failure(input).some((issue) => issue.code === "INVALID_MODEL_MAPPING"),
  );
});
