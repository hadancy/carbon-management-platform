import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataItemSchema,
  dataItemFieldsSchema,
  dataItemListQuerySchema,
  publishDataItemSchema,
  retireDataItemSchema,
  updateDataItemSchema,
} from "../src/shared/data-items";

test("data item drafts can omit a unit while publication requires a catalog unit", () => {
  const draft = createDataItemSchema.parse({
    code: " diesel ",
    dataName: " 柴油 ",
  });
  assert.equal(draft.code, "DIESEL");
  assert.equal(draft.dataName, "柴油");
  const fields = dataItemFieldsSchema.parse({ dataName: draft.dataName });
  assert.equal(
    publishDataItemSchema.safeParse({ ...fields, revision: 1 }).success,
    false,
  );
  assert.equal(
    publishDataItemSchema.safeParse({
      ...fields,
      functionalUnit: "L",
      revision: 1,
    }).success,
    true,
  );
  assert.equal(
    dataItemFieldsSchema.safeParse({ ...fields, functionalUnit: "升" }).success,
    false,
  );
});

test("factor data reject embedded units, infinity and values exceeding the limit", () => {
  for (const emissionFactor of [
    "2 kgCO₂e/kg",
    "NaN",
    "Infinity",
    "1e999",
    "1".repeat(121),
  ])
    assert.equal(
      dataItemFieldsSchema.safeParse({ dataName: "钢材", emissionFactor })
        .success,
      false,
    );
  for (const emissionFactor of ["", "0", "-1.2", "2.68e-3"])
    assert.equal(
      dataItemFieldsSchema.safeParse({ dataName: "钢材", emissionFactor })
        .success,
      true,
    );
});

test("management payloads cannot overwrite status, version, identity or publication metadata", () => {
  const fields = { dataName: "钢材", revision: 1 };
  for (const extra of [
    { status: "PUBLISHED" },
    { version: 9 },
    { dataItemId: "foreign" },
    { publishedAt: new Date().toISOString() },
    { code: "RENAME" },
  ])
    assert.equal(
      updateDataItemSchema.safeParse({ ...fields, ...extra }).success,
      false,
    );
  for (const revision of [undefined, 0, -1, 1.2])
    assert.equal(
      updateDataItemSchema.safeParse({ ...fields, revision }).success,
      false,
    );
  assert.equal(
    retireDataItemSchema.safeParse({ revision: 1, reason: "   " }).success,
    false,
  );
  assert.equal(
    retireDataItemSchema.parse({ revision: 1, reason: " 来源失效 " }).reason,
    "来源失效",
  );
});

test("library queries bound pagination and restrict status and units", () => {
  assert.equal(
    dataItemListQuerySchema.parse({ page: "2", pageSize: "10" }).page,
    2,
  );
  assert.equal(dataItemListQuerySchema.parse({}).status, "ALL");
  for (const input of [
    { pageSize: 101 },
    { page: 0 },
    { page: "NaN" },
    { status: "INACTIVE" },
    { unit: "随意单位" },
    { q: "a".repeat(201) },
  ])
    assert.equal(dataItemListQuerySchema.safeParse(input).success, false);
});
