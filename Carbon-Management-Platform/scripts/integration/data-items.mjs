import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { verifyDataItemsBrowser } from "./data-items-browser.mjs";

// This helper runs only against stage3-smoke's disposable database.
export async function verifyDataItemLibrary({
  api,
  expectStatus,
  baseURL,
  adminCookie,
  schoolCookie,
  viewerCookie,
  databaseUrl,
}) {
  const root = "/api/admin/data-items";
  const fields = {
    dataName: "SYN 公共钢材",
    specModel: "Q235-SYN",
    manufacturer: "SYN 测试厂家",
    carbonFootprintFactor: "SYN 原始资料",
    functionalUnit: "",
    emissionFactor: "2.68",
    factorSource: "SYN 工程验证因子来源",
    dataSource: "SYN 工程验证数据来源",
  };
  const draft = (
    await expectStatus(root, 201, {
      method: "POST",
      cookie: adminCookie,
      body: { code: "syn_item_steel", ...fields },
    })
  ).entry;
  assert.equal(draft.code, "SYN_ITEM_STEEL");
  assert.equal(draft.version, 1);
  const path = `${root}/${draft.id}`;

  const endpoints = [
    [root, "GET", undefined],
    [root, "POST", { code: "DENIED", ...fields }],
    [path, "PATCH", { ...fields, revision: 1 }],
    [
      `${path}/publish`,
      "POST",
      { ...fields, functionalUnit: "kg", revision: 1 },
    ],
    [`${path}/new-version`, "POST", fields],
    [`${path}/retire`, "POST", { revision: 1, reason: "SYN" }],
  ];
  for (const [endpoint, method, body] of endpoints) {
    await expectStatus(endpoint, 401, { method, body });
    for (const cookie of [schoolCookie, viewerCookie])
      await expectStatus(endpoint, 403, { method, body, cookie });
  }
  await expectStatus("/admin/data-items", 200, { cookie: adminCookie });
  await expectStatus("/admin/data-items", 404, { cookie: schoolCookie });
  await expectStatus(root, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "SYN_ITEM_STEEL", ...fields },
  });
  await expectStatus(root, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "BAD_UNIT", ...fields, functionalUnit: "随意单位" },
  });
  await expectStatus(root, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "BAD_FACTOR", ...fields, emissionFactor: "2 kgCO₂e/kg" },
  });
  await expectStatus(root, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { code: "BAD_STATUS", ...fields, status: "PUBLISHED" },
  });
  await expectStatus(`${path}/publish`, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { ...fields, revision: 1 },
  });
  const unchanged = await expectStatus(`${root}?q=SYN_ITEM_STEEL`, 200, {
    cookie: adminCookie,
  });
  assert.equal(unchanged.entries[0].revision, 1);
  assert.equal(unchanged.entries[0].status, "DRAFT");
  await expectStatus(`${root}/${randomUUID()}`, 404, {
    method: "PATCH",
    cookie: adminCookie,
    body: { ...fields, revision: 1 },
  });
  await expectStatus(`${root}/invalid-id/publish`, 400, {
    method: "POST",
    cookie: adminCookie,
    body: {},
  });
  await expectStatus(`${path}/new-version`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: fields,
  });
  await expectStatus(`${path}/retire`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { revision: 1, reason: "SYN" },
  });

  const complete = { ...fields, functionalUnit: "kg" };
  const updated = (
    await expectStatus(path, 200, {
      method: "PATCH",
      cookie: adminCookie,
      body: { ...complete, revision: 1 },
    })
  ).entry;
  assert.equal(updated.revision, 2);
  await expectStatus(path, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: { ...complete, dataName: "SYN stale", revision: 1 },
  });
  await expectStatus(`${path}/publish`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { ...complete, revision: 1 },
  });
  const published = (
    await expectStatus(`${path}/publish`, 200, {
      method: "POST",
      cookie: adminCookie,
      body: { ...complete, revision: 2 },
    })
  ).entry;
  assert.equal(published.status, "PUBLISHED");
  assert.ok(published.publishedAt);
  await expectStatus(path, 409, {
    method: "PATCH",
    cookie: adminCookie,
    body: { ...complete, revision: published.revision },
  });
  await expectStatus(`${path}/publish`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { ...complete, revision: published.revision },
  });

  const nextFields = { ...complete, emissionFactor: "2.7" };
  const raced = await Promise.all(
    [1, 2].map(() =>
      api(`${path}/new-version`, {
        method: "POST",
        cookie: adminCookie,
        body: nextFields,
      }),
    ),
  );
  assert.deepEqual(
    raced.map((result) => result.response.status).sort(),
    [201, 409],
  );
  const next = raced.find((result) => result.response.status === 201).data
    .entry;
  assert.equal(next.dataItemId, draft.dataItemId);
  assert.equal(next.version, 2);
  await expectStatus(`${path}/new-version`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: nextFields,
  });
  const v2 = (
    await expectStatus(`${root}/${next.id}/publish`, 200, {
      method: "POST",
      cookie: adminCookie,
      body: { ...nextFields, revision: next.revision },
    })
  ).entry;
  assert.equal(v2.emissionFactor, "2.7");

  // Same name with a different specification is a separate catalog identity.
  const variant = (
    await expectStatus(root, 201, {
      method: "POST",
      cookie: adminCookie,
      body: { code: "SYN_ITEM_VARIANT", ...complete, specModel: "Q355-SYN" },
    })
  ).entry;
  assert.notEqual(variant.dataItemId, draft.dataItemId);
  await expectStatus(`${path}/retire`, 400, {
    method: "POST",
    cookie: adminCookie,
    body: { revision: published.revision, reason: " " },
  });
  await expectStatus(`${path}/retire`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { revision: 1, reason: "SYN" },
  });
  const retired = (
    await expectStatus(`${path}/retire`, 200, {
      method: "POST",
      cookie: adminCookie,
      body: { revision: published.revision, reason: "SYN 来源更新，保留历史" },
    })
  ).entry;
  assert.ok(retired.retiredAt);
  assert.equal(retired.emissionFactor, "2.68");
  assert.equal(retired.publishedAt, published.publishedAt);
  await expectStatus(`${path}/retire`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { revision: retired.revision, reason: "SYN 重复" },
  });

  for (const q of ["syn_item_steel", "公共钢材", "Q235-SYN", "SYN 测试厂家"]) {
    const list = await expectStatus(`${root}?q=${encodeURIComponent(q)}`, 200, {
      cookie: adminCookie,
    });
    assert.ok(list.entries.some((entry) => entry.id === draft.id));
  }
  for (const [status, ids] of [
    ["PUBLISHED", [v2.id]],
    ["DRAFT", [variant.id]],
    ["RETIRED", [draft.id]],
  ]) {
    const list = await expectStatus(
      `${root}?q=SYN_ITEM&status=${status}&unit=kg`,
      200,
      { cookie: adminCookie },
    );
    assert.deepEqual(
      list.entries.map((entry) => entry.id),
      ids,
    );
  }
  const page2 = await expectStatus(
    `${root}?q=SYN_ITEM&pageSize=1&page=2`,
    200,
    { cookie: adminCookie },
  );
  assert.equal(page2.total, 3);
  assert.equal(page2.entries.length, 1);
  assert.equal(page2.query.page, 2);
  const overflow = await expectStatus(
    `${root}?q=SYN_ITEM&pageSize=1&page=999`,
    200,
    { cookie: adminCookie },
  );
  assert.equal(overflow.query.page, 3);
  for (const query of [
    "pageSize=101",
    "status=INVALID",
    "unit=INVALID",
    "page=0",
  ])
    await expectStatus(`${root}?${query}`, 400, { cookie: adminCookie });

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT action FROM "AuditLog" WHERE "targetType" = $1',
      ["DataItemVersion"],
    );
    for (const action of [
      "data-item.create",
      "data-item.update",
      "data-item.publish",
      "data-item.new-version",
      "data-item.retire",
    ])
      assert.ok(rows.some((row) => row.action === action));
  } finally {
    await client.end();
  }
  await verifyDataItemsBrowser({ baseURL, adminCookie });
  console.log(
    "Public data items passed: administrator-only access, draft validation, publication, concurrent revision/version conflicts, frozen history, retirement, search, pagination, audit and browser workflow.",
  );
}
