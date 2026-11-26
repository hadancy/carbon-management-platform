import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { verifyModelDataItemsBrowser } from "./model-data-items-browser.mjs";

// Synthetic models now use the same published library path as application users.
export async function attachCatalogItems({
  content,
  prefix,
  expectStatus,
  adminCookie,
}) {
  let index = 0;
  for (const stage of content.stages)
    for (const category of stage.categories) {
      for (let i = 0; i < category.items.length; i++) {
        const { id, ...fields } = category.items[i];
        const draft = (
          await expectStatus("/api/admin/data-items", 201, {
            method: "POST",
            cookie: adminCookie,
            body: { code: `${prefix}_${++index}`, ...fields },
          })
        ).entry;
        const entry = (
          await expectStatus(`/api/admin/data-items/${draft.id}/publish`, 200, {
            method: "POST",
            cookie: adminCookie,
            body: { ...fields, revision: draft.revision },
          })
        ).entry;
        category.items[i] = {
          id,
          ...fields,
          librarySource: {
            dataItemId: entry.dataItemId,
            versionId: entry.id,
            code: entry.code,
            version: entry.version,
          },
        };
        assert.equal(category.items[i].librarySource.version, 1);
      }
    }
}

const fieldsOf = (entry) =>
  Object.fromEntries(
    [
      "dataName",
      "specModel",
      "manufacturer",
      "carbonFootprintFactor",
      "functionalUnit",
      "emissionFactor",
      "factorSource",
      "dataSource",
    ].map((key) => [key, entry[key]]),
  );
const occurrence = (entry, id = randomUUID()) => ({
  id,
  ...fieldsOf(entry),
  librarySource: {
    dataItemId: entry.dataItemId,
    versionId: entry.id,
    code: entry.code,
    version: entry.version,
  },
});
export { occurrence as catalogOccurrence };

export async function verifyModelDataItemReferences({
  expectStatus,
  baseURL,
  adminCookie,
  schoolCookie,
  schoolBCookie,
  viewerCookie,
  reviewerCookie,
  databaseUrl,
}) {
  const library = "/api/admin/data-items";
  const fields = {
    dataName: "REF 共用钢材",
    specModel: "Q235-REF",
    manufacturer: "REF 厂家",
    carbonFootprintFactor: "REF 原始资料",
    functionalUnit: "kg",
    emissionFactor: "2",
    factorSource: "REF 因子来源",
    dataSource: "REF 数据来源",
  };
  const createDraft = async (code, input = fields) =>
    (
      await expectStatus(library, 201, {
        method: "POST",
        cookie: adminCookie,
        body: { code, ...input },
      })
    ).entry;
  const publish = async (draft, input = fields) =>
    (
      await expectStatus(`${library}/${draft.id}/publish`, 200, {
        method: "POST",
        cookie: adminCookie,
        body: { ...input, revision: draft.revision },
      })
    ).entry;
  const source = await publish(await createDraft("REF_STEEL"));
  const unpublished = await createDraft("REF_UNPUBLISHED");
  await expectStatus("/api/data-items", 401);
  for (const cookie of [adminCookie, schoolCookie, viewerCookie]) {
    const list = await expectStatus("/api/data-items?q=REF_", 200, { cookie });
    assert.deepEqual(
      list.entries.map((entry) => entry.id),
      [source.id],
    );
    await expectStatus("/api/data-items?status=DRAFT", 400, { cookie });
  }
  await expectStatus("/api/data-items", 405, {
    method: "POST",
    cookie: schoolCookie,
    body: fields,
  });
  const content = {
    name: "REF 引用模型",
    functionalQuantity: 1,
    functionalUnit: "kg",
    functionalDescription: "",
    boundary: "REF 边界",
    boundaryDiagram: "",
    referenceStandard: "REF 工程测试",
    description: "REF 临时库测试",
    stages: [
      {
        id: randomUUID(),
        name: "原料",
        categories: [
          { id: randomUUID(), name: "材料", items: [occurrence(source)] },
        ],
      },
    ],
  };
  const firstItem = (value) => value.stages[0].categories[0].items[0];
  const raw = structuredClone(content);
  delete firstItem(raw).librarySource;
  for (const [path, cookie] of [
    ["/api/models", schoolCookie],
    ["/api/admin/models", adminCookie],
  ])
    await expectStatus(path, 400, {
      method: "POST",
      cookie,
      body: { code: "REF_INLINE_DENIED", content: raw },
    });
  const forged = structuredClone(content);
  Object.assign(firstItem(forged), {
    dataName: "伪造名称",
    manufacturer: "伪造厂家",
    emissionFactor: "999",
    functionalUnit: "L",
  });
  const model = (
    await expectStatus("/api/models", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: { code: "REF_MODEL_A", content: forged },
    })
  ).model;
  const version = model.versions[0];
  assert.deepEqual(firstItem(version.content), firstItem(content));
  const otherContent = structuredClone(content);
  firstItem(otherContent).id = randomUUID();
  const other = (
    await expectStatus("/api/models", 201, {
      method: "POST",
      cookie: schoolBCookie,
      body: { code: "REF_MODEL_B", content: otherContent },
    })
  ).model;
  assert.equal(
    firstItem(other.versions[0].content).librarySource.versionId,
    source.id,
  );
  assert.notEqual(
    firstItem(other.versions[0].content).id,
    firstItem(version.content).id,
  );
  for (const invalidSource of [
    {
      ...source,
      id: unpublished.id,
      dataItemId: unpublished.dataItemId,
      code: unpublished.code,
    },
    { ...source, dataItemId: randomUUID() },
  ]) {
    const invalid = structuredClone(content);
    invalid.stages[0].categories[0].items = [occurrence(invalidSource)];
    await expectStatus("/api/models", 400, {
      method: "POST",
      cookie: schoolCookie,
      body: { code: "REF_INVALID_SOURCE", content: invalid },
    });
  }
  const duplicate = structuredClone(content);
  duplicate.stages[0].categories[0].items.push(occurrence(source));
  await expectStatus("/api/models", 400, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "REF_DUPLICATE", content: duplicate },
  });
  const crossed = structuredClone(content);
  crossed.stages[0].categories.push({
    id: randomUUID(),
    name: "另一大类",
    items: [occurrence(source)],
  });
  await expectStatus("/api/models", 201, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "REF_CROSS_CATEGORY", content: crossed },
  });
  const modified = structuredClone(version.content);
  firstItem(modified).emissionFactor = "100";
  await expectStatus(`/api/model-versions/${version.id}`, 400, {
    method: "PATCH",
    cookie: schoolCookie,
    body: modified,
  });
  const removedSource = structuredClone(version.content);
  delete firstItem(removedSource).librarySource;
  await expectStatus(`/api/model-versions/${version.id}`, 400, {
    method: "PATCH",
    cookie: schoolCookie,
    body: removedSource,
  });
  await expectStatus(`/api/model-versions/${version.id}`, 404, {
    method: "PATCH",
    cookie: schoolBCookie,
    body: content,
  });

  const nextFields = { ...fields, emissionFactor: "3" };
  const nextDraft = (
    await expectStatus(`${library}/${source.id}/new-version`, 201, {
      method: "POST",
      cookie: adminCookie,
      body: nextFields,
    })
  ).entry;
  const v2 = await publish(nextDraft, nextFields);
  const selectedV2 = structuredClone(version.content);
  selectedV2.stages[0].categories[0].items = [
    occurrence(v2, firstItem(version.content).id),
  ];
  const saved = (
    await expectStatus(`/api/model-versions/${version.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: { ...selectedV2, description: "REF 已保存" },
    })
  ).version;
  assert.equal(firstItem(saved.content).emissionFactor, "3");
  assert.equal(firstItem(saved.content).librarySource.version, 2);
  await expectStatus(`/api/model-versions/${version.id}/transition`, 200, {
    method: "POST",
    cookie: schoolCookie,
    body: { action: "submit" },
  });
  const publishedModel = (
    await expectStatus(`/api/model-versions/${version.id}/transition`, 200, {
      method: "POST",
      cookie: reviewerCookie,
      body: { action: "publish" },
    })
  ).version;
  await expectStatus(`${library}/${source.id}/retire`, 409, {
    method: "POST",
    cookie: adminCookie,
    body: { revision: source.revision, reason: "REF 停用旧版" },
  });
  const available = await expectStatus("/api/data-items?q=REF_STEEL", 200, {
    cookie: schoolCookie,
  });
  assert.deepEqual(
    available.entries.map((entry) => entry.id),
    [v2.id],
  );
  await expectStatus("/api/models", 400, {
    method: "POST",
    cookie: schoolCookie,
    body: { code: "REF_RETIRED_DENIED", content },
  });
  const inherited = (
    await expectStatus(`/api/models/${model.id}/versions`, 201, {
      method: "POST",
      cookie: schoolCookie,
      body: {},
    })
  ).version;
  await expectStatus(`/api/model-versions/${inherited.id}`, 200, {
    method: "PATCH",
    cookie: schoolCookie,
    body: { ...inherited.content, description: "REF 保存新版草稿" },
  });
  const replace = structuredClone(inherited.content);
  replace.stages[0].categories[0].items = [
    occurrence(v2, firstItem(inherited.content).id),
  ];
  const replaced = (
    await expectStatus(`/api/model-versions/${inherited.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: replace,
    })
  ).version;
  assert.equal(
    firstItem(replaced.content).id,
    firstItem(publishedModel.content).id,
  );
  assert.equal(firstItem(replaced.content).librarySource.version, 2);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const frozen = (
      await client.query('SELECT content FROM "ModelVersion" WHERE id = $1', [
        version.id,
      ])
    ).rows[0].content;
    assert.deepEqual(frozen, publishedModel.content);
    const legacy = structuredClone(raw);
    firstItem(legacy).emissionFactor = "2 kgCO₂e/kg";
    const empty = structuredClone(legacy);
    empty.stages[0].categories[0].items = [];
    const old = (
      await expectStatus("/api/models", 201, {
        method: "POST",
        cookie: schoolCookie,
        body: { code: "REF_LEGACY", content: empty },
      })
    ).model.versions[0];
    // Simulate a record saved before the catalog rollout without relaxing application write rules.
    await client.query(
      'UPDATE "ModelVersion" SET content = $1::jsonb WHERE id = $2',
      [JSON.stringify(legacy), old.id],
    );
    await expectStatus(`/api/model-versions/${old.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: { ...legacy, description: "REF 旧数据保留" },
    });
    const normalized = structuredClone(legacy);
    firstItem(normalized).emissionFactor = "2";
    await expectStatus(`/api/model-versions/${old.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: normalized,
    });
    const changed = structuredClone(normalized);
    firstItem(changed).manufacturer = "用户修改";
    await expectStatus(`/api/model-versions/${old.id}`, 400, {
      method: "PATCH",
      cookie: schoolCookie,
      body: changed,
    });
    changed.stages[0].categories[0].items = [
      occurrence(v2, firstItem(normalized).id),
    ];
    await expectStatus(`/api/model-versions/${old.id}`, 200, {
      method: "PATCH",
      cookie: schoolCookie,
      body: changed,
    });
  } finally {
    await client.end();
  }

  for (let index = 1; index <= 12; index++) {
    const code = `PICK_ITEM_${String(index).padStart(2, "0")}`;
    const input = {
      ...fields,
      dataName: `REF UI 材料 ${index}`,
      specModel: `UI-${index}`,
    };
    const version = await publish(await createDraft(code, input), input);
    if (index === 3) {
      const revised = { ...input, emissionFactor: "200" };
      const draft = (
        await expectStatus(`${library}/${version.id}/new-version`, 201, {
          method: "POST",
          cookie: adminCookie,
          body: revised,
        })
      ).entry;
      await publish(draft, revised);
    }
  }
  const pickerContent = structuredClone(content);
  pickerContent.stages[0].categories[0].items = [];
  const pickerModel = (
    await expectStatus("/api/models", 201, {
      method: "POST",
      cookie: schoolCookie,
      body: { code: "REF_PICKER_MODEL", content: pickerContent },
    })
  ).model;
  await verifyModelDataItemsBrowser({
    baseURL,
    schoolCookie,
    modelId: pickerModel.id,
    versionId: pickerModel.versions[0].id,
  });
  console.log(
    "Model data item references passed: public read permissions, server canonical snapshots, shared identities across schools, duplicate/forged/unpublished/retired reference rejection, immutable history, legacy compatibility and browser selection.",
  );
}
