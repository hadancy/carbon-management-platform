import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  modelItemFromCatalog,
  selectModelDataItems,
} from "../src/shared/model-data-items";
import { modelItemSchema } from "../src/shared/models";
import type { DataItemEntry } from "../src/shared/data-items";

function catalog(overrides: Partial<DataItemEntry> = {}): DataItemEntry {
  return {
    id: randomUUID(),
    dataItemId: randomUUID(),
    code: "TEST_STEEL",
    version: 1,
    revision: 2,
    status: "PUBLISHED",
    dataName: "钢材",
    specModel: "Q235",
    manufacturer: "测试厂家",
    functionalUnit: "kg",
    emissionFactor: "2",
    carbonFootprintFactor: "资料",
    factorSource: "来源",
    dataSource: "数据源",
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    publishedAt: "2026-10-29T00:00:00.000Z",
    retiredAt: null,
    retirementReason: null,
    ...overrides,
  };
}

test("catalog selections retain exact source and independent occurrence IDs without sharing mutable state", () => {
  const source = catalog();
  const first = selectModelDataItems([], [source], randomUUID)[0];
  const second = selectModelDataItems([], [source], randomUUID)[0];
  assert.notEqual(first.id, second.id);
  assert.equal(first.librarySource?.versionId, source.id);
  assert.equal(first.librarySource?.dataItemId, source.dataItemId);
  first.dataName = "局部变化";
  first.librarySource!.code = "CHANGED";
  assert.equal(source.dataName, "钢材");
  assert.equal(second.dataName, "钢材");
  assert.equal(second.librarySource!.code, "TEST_STEEL");
  assert.ok(!("retiredAt" in first));
});

test("replacing a public or legacy item preserves its occurrence ID for calculation mappings", () => {
  const source = catalog();
  const item = modelItemFromCatalog(source, randomUUID());
  const replacement = catalog({
    dataItemId: source.dataItemId,
    version: 2,
    emissionFactor: "3",
  });
  const changed = selectModelDataItems(
    [item],
    [replacement],
    randomUUID,
    item.id,
  )[0];
  assert.equal(changed.id, item.id);
  assert.equal(changed.librarySource?.version, 2);
  assert.equal(changed.emissionFactor, "3");
  assert.equal(item.emissionFactor, "2");
  const legacy = { ...item };
  delete legacy.librarySource;
  assert.equal(
    selectModelDataItems([legacy], [replacement], randomUUID, legacy.id)[0].id,
    legacy.id,
  );
  assert.equal("librarySource" in modelItemSchema.parse(legacy), false);
});

test("the same catalog identity cannot be added twice to a category even through different versions", () => {
  const first = catalog();
  const next = catalog({ dataItemId: first.dataItemId, version: 2 });
  const current = modelItemFromCatalog(first, randomUUID());
  assert.throws(
    () => selectModelDataItems([current], [next], randomUUID),
    /重复/,
  );
  assert.throws(
    () => selectModelDataItems([], [first, next], randomUUID),
    /重复/,
  );
  assert.equal(
    selectModelDataItems(
      [],
      [first, catalog({ specModel: "Q355" })],
      randomUUID,
    ).length,
    2,
  );
  assert.throws(
    () => selectModelDataItems([current], [next], randomUUID, randomUUID()),
    /已移除/,
  );
});

test("batch selection respects category limits and reference metadata rejects malformed values", () => {
  const full = Array.from({ length: 300 }, () =>
    modelItemFromCatalog(catalog(), randomUUID()),
  );
  assert.throws(
    () => selectModelDataItems(full, [catalog()], randomUUID),
    /300/,
  );
  const item = modelItemFromCatalog(catalog(), randomUUID());
  assert.equal(
    modelItemSchema.safeParse({
      ...item,
      librarySource: { ...item.librarySource, version: 0 },
    }).success,
    false,
  );
  assert.equal(
    modelItemSchema.safeParse({
      ...item,
      librarySource: { ...item.librarySource, extra: true },
    }).success,
    false,
  );
});
