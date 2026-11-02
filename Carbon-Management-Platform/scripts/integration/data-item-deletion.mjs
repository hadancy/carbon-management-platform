import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { verifyDataItemDeletionBrowser } from "./data-item-deletion-browser.mjs";

const fields = {
  dataName: "DELETE 工程验证材料",
  specModel: "DEL-TEST",
  manufacturer: "DELETE 测试厂家",
  carbonFootprintFactor: "DELETE 资料",
  functionalUnit: "kg",
  emissionFactor: "2",
  factorSource: "DELETE 测试来源",
  dataSource: "DELETE 测试资料",
};
const contentFor = (entry) => ({
  name: "DELETE 引用保护模型",
  functionalQuantity: 1,
  functionalUnit: "kg",
  functionalDescription: "",
  boundary: "DELETE 边界",
  boundaryDiagram: "",
  referenceStandard: "DELETE 工程测试",
  description: "仅用于临时库验收",
  stages: [
    {
      id: randomUUID(),
      name: "原料",
      categories: [
        {
          id: randomUUID(),
          name: "材料",
          items: entry
            ? [
                {
                  id: randomUUID(),
                  ...fields,
                  librarySource: {
                    dataItemId: entry.dataItemId,
                    versionId: entry.id,
                    code: entry.code,
                    version: entry.version,
                  },
                },
              ]
            : [],
        },
      ],
    },
  ],
});

export async function verifyDataItemDeletion({
  api,
  expectStatus,
  baseURL,
  adminCookie,
  schoolCookie,
  viewerCookie,
  reviewerCookie,
  databaseUrl,
}) {
  assert.match(
    new URL(databaseUrl).pathname,
    /^\/carbon_stage3_[a-f0-9]+$/,
    "Deletion acceptance only runs against the disposable smoke database",
  );
  const root = "/api/admin/data-items";
  const draft = async (code) =>
    (
      await expectStatus(root, 201, {
        method: "POST",
        cookie: adminCookie,
        body: { code, ...fields },
      })
    ).entry;
  const publish = async (entry) =>
    (
      await expectStatus(`${root}/${entry.id}/publish`, 200, {
        method: "POST",
        cookie: adminCookie,
        body: { ...fields, revision: entry.revision },
      })
    ).entry;
  const remove = (entry, status = 200) =>
    expectStatus(`${root}/${entry.id}`, status, {
      method: "DELETE",
      cookie: adminCookie,
      body: { revision: entry.revision },
    });
  const model = async (entry, code) =>
    (
      await expectStatus("/api/models", 201, {
        method: "POST",
        cookie: schoolCookie,
        body: { code, content: contentFor(entry) },
      })
    ).model;
  const publishModel = async (version) => {
    await expectStatus(`/api/model-versions/${version.id}/transition`, 200, {
      method: "POST",
      cookie: schoolCookie,
      body: { action: "submit" },
    });
    return (
      await expectStatus(`/api/model-versions/${version.id}/transition`, 200, {
        method: "POST",
        cookie: reviewerCookie,
        body: { action: "publish" },
      })
    ).version;
  };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const first = await draft("DELETE_DRAFT");
    for (const [cookie, status] of [
      [undefined, 401],
      [schoolCookie, 403],
      [viewerCookie, 403],
    ])
      await expectStatus(`${root}/${first.id}`, status, {
        method: "DELETE",
        cookie,
        body: { revision: first.revision },
      });
    for (const body of [
      {},
      { revision: 0 },
      { revision: first.revision, force: true },
    ])
      await expectStatus(`${root}/${first.id}`, 400, {
        method: "DELETE",
        cookie: adminCookie,
        body,
      });
    await remove(first);
    assert.equal(
      (
        await client.query('SELECT id FROM "DataItemVersion" WHERE id = $1', [
          first.id,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await client.query('SELECT id FROM "DataItem" WHERE id = $1', [
          first.dataItemId,
        ])
      ).rowCount,
      0,
    );
    await remove(first, 404);
    const reused = await draft(first.code);
    assert.notEqual(reused.dataItemId, first.dataItemId);
    await remove(reused);
    const free = await publish(await draft("DELETE_PUBLISHED_UNUSED"));
    await remove(free);
    const audit = (
      await client.query(
        'SELECT details FROM "AuditLog" WHERE action = $1 AND "targetId" = $2',
        ["data-item.delete", free.id],
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].details.code, free.code);
    assert.equal(audit[0].details.snapshot.status, "PUBLISHED");
    assert.equal(audit[0].details.snapshot.publishedAt, free.publishedAt);
    assert.equal(audit[0].details.snapshot.factorSource, fields.factorSource);
    const retired = await publish(await draft("DELETE_RETIRED_UNUSED"));
    const stopped = (
      await expectStatus(`${root}/${retired.id}/retire`, 200, {
        method: "POST",
        cookie: adminCookie,
        body: { revision: retired.revision, reason: "DELETE 测试停用" },
      })
    ).entry;
    await remove(stopped);
    const stale = await draft("DELETE_STALE");
    const edited = (
      await expectStatus(`${root}/${stale.id}`, 200, {
        method: "PATCH",
        cookie: adminCookie,
        body: { ...fields, specModel: "DEL-EDIT", revision: stale.revision },
      })
    ).entry;
    await remove(stale, 409);
    await remove(edited);

    const v1 = await publish(await draft("DELETE_VERSIONS"));
    const v2 = (
      await expectStatus(`${root}/${v1.id}/new-version`, 201, {
        method: "POST",
        cookie: adminCookie,
        body: fields,
      })
    ).entry;
    await remove(v2);
    const v3 = (
      await expectStatus(`${root}/${v1.id}/new-version`, 201, {
        method: "POST",
        cookie: adminCookie,
        body: fields,
      })
    ).entry;
    assert.equal(
      v3.version,
      3,
      "Deleting a version must never cause its version number to be reused",
    );
    const v3Published = await publish(v3);
    await remove(v1);
    assert.equal(
      (
        await client.query('SELECT id FROM "DataItemVersion" WHERE id = $1', [
          v3.id,
        ])
      ).rowCount,
      1,
    );
    const v4 = (
      await expectStatus(`${root}/${v3.id}/new-version`, 201, {
        method: "POST",
        cookie: adminCookie,
        body: fields,
      })
    ).entry;
    assert.equal(v4.version, 4);
    await remove(v4);
    await remove(v3Published);

    const used = await publish(await draft("DELETE_EVER_USED"));
    const transient = await model(used, "DELETE_TRANSIENT_MODEL");
    await remove(used, 409);
    const empty = structuredClone(transient.versions[0].content);
    empty.stages[0].categories[0].items = [];
    await expectStatus(`/api/model-versions/${transient.versions[0].id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: empty,
    });
    await remove(used, 409);
    await expectStatus(`/api/model-versions/${transient.versions[0].id}`, 200, {
      method: "DELETE",
      cookie: schoolCookie,
    });
    await remove(used, 409);
    const usedList = await expectStatus(`${root}?q=DELETE_EVER_USED`, 200, {
      cookie: adminCookie,
    });
    assert.equal(usedList.entries[0].referenceCount, 1);
    const usedStopped = (
      await expectStatus(`${root}/${used.id}/retire`, 200, {
        method: "POST",
        cookie: adminCookie,
        body: { revision: used.revision, reason: "DELETE 已引用可停用" },
      })
    ).entry;
    await remove(usedStopped, 409);
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1 AND "targetId" = $2',
          ["data-item.delete", used.id],
        )
      ).rows[0].n,
      0,
    );

    const historySource = await publish(await draft("DELETE_HISTORY"));
    const alternative = await publish(await draft("DELETE_ALTERNATIVE"));
    const historical = await model(historySource, "DELETE_HISTORY_MODEL");
    const originalVersion = await publishModel(historical.versions[0]);
    const next = (
      await expectStatus(`/api/models/${historical.id}/versions`, 201, {
        method: "POST",
        cookie: schoolCookie,
        body: {},
      })
    ).version;
    const replace = contentFor(alternative);
    await expectStatus(`/api/model-versions/${next.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: replace,
    });
    await publishModel(next);
    await expectStatus(`/api/models/${historical.id}`, 200, {
      method: "DELETE",
      cookie: schoolCookie,
    });
    await remove(historySource, 409);
    await remove(alternative, 409);
    const retained = (
      await client.query('SELECT content FROM "ModelVersion" WHERE id = $1', [
        originalVersion.id,
      ])
    ).rows[0].content;
    assert.deepEqual(retained, originalVersion.content);

    const legacySource = await publish(await draft("DELETE_OLD_REFERENCE"));
    const legacyModel = await model(null, "DELETE_OLD_MODEL");
    const oldVersionId = legacyModel.versions[0].id;
    await client.query(
      'UPDATE "ModelVersion" SET content = $1::jsonb WHERE id = $2',
      [JSON.stringify(contentFor(legacySource)), oldVersionId],
    );
    assert.equal(
      (
        await client.query(
          'SELECT * FROM "DataItemUsage" WHERE "dataItemVersionId" = $1',
          [legacySource.id],
        )
      ).rowCount,
      0,
    );
    await remove(legacySource, 409);
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20261029020000_data_item_deletion/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const backfill = migration.slice(migration.indexOf("WITH sources AS"));
    await client.query(backfill);
    await client.query(backfill);
    assert.equal(
      (
        await client.query(
          'SELECT * FROM "DataItemUsage" WHERE "dataItemVersionId" = $1',
          [legacySource.id],
        )
      ).rowCount,
      1,
    );
    await expectStatus(`/api/model-versions/${oldVersionId}`, 200, {
      method: "DELETE",
      cookie: schoolCookie,
    });
    await remove(legacySource, 409);

    for (let index = 0; index < 3; index++) {
      const race = await publish(await draft(`DELETE_RACE_${index}`));
      const [deleted, created] = await Promise.all([
        api(`${root}/${race.id}`, {
          method: "DELETE",
          cookie: adminCookie,
          body: { revision: race.revision },
        }),
        api("/api/models", {
          method: "POST",
          cookie: schoolCookie,
          body: {
            code: `DELETE_RACE_MODEL_${index}`,
            content: contentFor(race),
          },
        }),
      ]);
      assert.ok(
        (deleted.response.status === 200 && created.response.status === 400) ||
          (deleted.response.status === 409 && created.response.status === 201),
        `Unexpected race result: ${deleted.response.status}/${created.response.status}`,
      );
      const usages = (
        await client.query(
          'SELECT count(*)::int AS n FROM "DataItemUsage" WHERE "dataItemVersionId" = $1',
          [race.id],
        )
      ).rows[0].n;
      assert.equal(usages, created.response.status === 201 ? 1 : 0);
    }
    const double = await draft("DELETE_DOUBLE");
    const repeated = await Promise.all(
      [1, 2].map(() =>
        api(`${root}/${double.id}`, {
          method: "DELETE",
          cookie: adminCookie,
          body: { revision: double.revision },
        }),
      ),
    );
    assert.deepEqual(
      repeated.map((result) => result.response.status).sort(),
      [200, 404],
    );
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1 AND "targetId" = $2',
          ["data-item.delete", double.id],
        )
      ).rows[0].n,
      1,
    );

    const uiDraft = await draft("DELETE_UI_DRAFT");
    const uiFree = await publish(await draft("DELETE_UI_FREE"));
    const uiUsed = await publish(await draft("DELETE_UI_USED"));
    await model(uiUsed, "DELETE_UI_USED_MODEL");
    const uiRace = await publish(await draft("DELETE_UI_RACE"));
    await verifyDataItemDeletionBrowser({
      baseURL,
      adminCookie,
      entries: { draft: uiDraft, free: uiFree, used: uiUsed, race: uiRace },
      makeReferenced: () => model(uiRace, "DELETE_UI_RACE_MODEL"),
    });
    for (const entry of [uiDraft, uiFree])
      assert.equal(
        (
          await client.query(
            'SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1 AND "targetId" = $2',
            ["data-item.delete", entry.id],
          )
        ).rows[0].n,
        1,
      );
  } finally {
    await client.end();
  }
  console.log(
    "Data item deletion passed: administrator access, draft/unreferenced deletion, immutable audit, code reuse, monotonic versions, historical/archived/removed references, backfill, concurrent new references and browser confirmation/stale-page protection.",
  );
}
