import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  emptyModelContent,
  modelContentSchema,
  normalizeLegacyModelContent,
  validatePublishableModel,
  type ModelContent,
} from "../src/shared/models";
import {
  emissionFactorDraftSchema,
  publishedEmissionFactorSchema,
} from "../src/shared/emission-factors";
import { factorUnitLabel, isNumericFactor } from "../src/shared/units";

function completeModel(): ModelContent {
  return {
    ...emptyModelContent(),
    name: "教学楼材料模型",
    functionalUnit: "kg",
    boundary: "从摇篮到大门",
    referenceStandard: "ISO 14067",
    stages: [
      {
        id: randomUUID(),
        name: "原料生产",
        categories: [
          {
            id: randomUUID(),
            name: "建材",
            items: [
              {
                id: randomUUID(),
                dataName: "钢材",
                specModel: "",
                manufacturer: "",
                carbonFootprintFactor: "",
                functionalUnit: "kg",
                emissionFactor: "",
                factorSource: "",
                dataSource: "",
              },
            ],
          },
        ],
      },
    ],
  };
}

test("each stage and category must contain data before publication", () => {
  const content = completeModel();
  assert.equal(validatePublishableModel(content), null);

  content.stages.push({ id: randomUUID(), name: "运输", categories: [] });
  assert.match(validatePublishableModel(content) ?? "", /阶段「运输」/);

  content.stages[1].categories.push({
    id: randomUUID(),
    name: "公路运输",
    items: [],
  });
  assert.match(validatePublishableModel(content) ?? "", /大类「公路运输」/);
});

test("published models require catalog units and a positive functional quantity", () => {
  const content = completeModel();
  content.functionalUnit = "1 kg";
  assert.match(validatePublishableModel(content) ?? "", /单位列表/);
  content.functionalUnit = "kg";
  content.functionalQuantity = null;
  assert.match(validatePublishableModel(content) ?? "", /数量须大于 0/);
  content.functionalQuantity = 1;
  content.stages[0].categories[0].items[0].functionalUnit = "千克";
  assert.match(
    validatePublishableModel(content) ?? "",
    /活动数据单位须从单位列表/,
  );
  content.stages[0].categories[0].items[0].functionalUnit = "kg";
  content.stages[0].categories[0].items[0].emissionFactor = "2 kgCO₂e/kWh";
  assert.match(validatePublishableModel(content) ?? "", /排放因子无法识别/);
});

test("legacy factor labels convert only when their units match the activity unit", () => {
  const content = completeModel();
  const item = content.stages[0].categories[0].items[0];
  item.emissionFactor = "190 kgCO₂e/kg";
  const transport = {
    ...item,
    id: randomUUID(),
    functionalUnit: "t·km",
    emissionFactor: "0.010 kgCO₂e/(t·km)",
  };
  content.stages[0].categories[0].items.push(transport);

  const normalized = normalizeLegacyModelContent(content);
  assert.equal(normalized.convertedFactors, 2);
  assert.equal(normalized.convertedUnits, 1);
  assert.equal(
    normalized.content.stages[0].categories[0].items[0].emissionFactor,
    "190",
  );
  assert.equal(
    normalized.content.stages[0].categories[0].items[1].functionalUnit,
    "t_km",
  );
  assert.equal(
    normalized.content.stages[0].categories[0].items[1].emissionFactor,
    "0.010",
  );
  assert.equal(validatePublishableModel(normalized.content), null);
  assert.equal(item.emissionFactor, "190 kgCO₂e/kg");
  assert.equal(transport.functionalUnit, "t·km");

  content.stages[0].categories[0].items[0].emissionFactor = "190 kgCO₂e/kWh";
  const mismatched = normalizeLegacyModelContent(content);
  assert.equal(
    mismatched.content.stages[0].categories[0].items[0].emissionFactor,
    "190 kgCO₂e/kWh",
  );
  assert.match(
    validatePublishableModel(mismatched.content) ?? "",
    /排放因子无法识别/,
  );
});

test("older model content remains readable without a functional quantity field", () => {
  const legacy: Record<string, unknown> = { ...completeModel() };
  delete legacy.functionalQuantity;
  delete legacy.functionalDescription;
  const parsed = modelContentSchema.parse(legacy);
  assert.equal(parsed.functionalQuantity, 1);
  assert.equal(parsed.functionalDescription, "");
});

test("factor unit follows the selected activity unit and publication checks it", () => {
  assert.equal(factorUnitLabel("t_km"), "kgCO₂e/(t·km)");
  assert.equal(isNumericFactor("2.5e-3"), true);
  assert.equal(isNumericFactor("2 kgCO₂e/kg"), false);
  const draft = emissionFactorDraftSchema.parse({
    value: "",
    activityUnit: "",
    emissionUnit: "kgCO2e",
  });
  assert.equal(publishedEmissionFactorSchema.safeParse(draft).success, false);
  assert.equal(
    publishedEmissionFactorSchema.safeParse({
      ...draft,
      value: "0.5",
      activityUnit: "kWh",
    }).success,
    true,
  );
  assert.equal(
    emissionFactorDraftSchema.parse({
      ...draft,
      region: "华东",
    }).region,
    "华东",
  );
});
