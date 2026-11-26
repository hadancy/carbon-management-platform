import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { catalogOccurrence } from "./model-data-items.mjs";

export async function verifyModelDataItemUpgrades({
  expectStatus,
  adminCookie,
  schoolCookie,
  schoolBCookie,
  reviewerCookie,
  schoolBReviewerCookie,
  databaseUrl,
}) {
  const library = "/api/admin/data-items";
  const fields = {
    dataName: "SYNC 钢材",
    functionalUnit: "kg",
    emissionFactor: "2.39",
    carbonFootprintFactor: "2.39kgCO2e/kg",
  };
  const post = (path, status, body, cookie = adminCookie) =>
    expectStatus(path, status, { method: "POST", body, cookie });
  const publish = (entry, data = fields) =>
    post(`${library}/${entry.id}/publish`, 200, {
      ...data,
      revision: entry.revision,
    });
  const createItem = async (code) =>
    (await publish((await post(library, 201, { code, ...fields })).entry))
      .entry;
  const nextDraft = async (entry, data) =>
    (await post(`${library}/${entry.id}/new-version`, 201, data)).entry;
  const transition = (version, status, reviewedAt) =>
    post(`/api/model-versions/${version.id}/transition`, status, {
      action: "publish",
      expectedUpdatedAt: reviewedAt,
    });
  const schoolTransition = (version, action, cookie, status = 200) =>
    post(
      `/api/model-versions/${version.id}/transition`,
      status,
      {
        action,
        note: action === "reject" ? "请核对原始资料" : undefined,
      },
      cookie,
    );
  const items = (version) => version.content.stages[0].categories[0].items;
  const sourceVersions = (version) =>
    items(version).map((item) => item.librarySource.versionId);

  const sourceA = await createItem("SYNC_A");
  const sourceB = await createItem("SYNC_B");
  const content = {
    name: "SYNC 公用模板",
    functionalUnit: "kg",
    boundary: "SYNC 计算边界",
    boundaryDiagram: "",
    referenceStandard: "SYNC 工程测试",
    description: "保留原草稿的编辑",
    stages: [
      {
        id: randomUUID(),
        name: "原材料",
        categories: [
          {
            id: randomUUID(),
            name: "钢材",
            items: [catalogOccurrence(sourceA), catalogOccurrence(sourceB)],
          },
        ],
      },
    ],
  };
  const editable = (
    await post("/api/admin/models", 201, {
      code: "SYNC_DRAFT_TEMPLATE",
      content,
    })
  ).model;
  const published = (
    await post("/api/admin/models", 201, {
      code: "SYNC_RELEASED_TEMPLATE",
      content,
    })
  ).model;
  const snapshot = (await transition(published.versions[0], 200)).version;
  const schoolCopy = (
    await post(
      "/api/models",
      201,
      {
        code: "SYNC_SCHOOL_COPY",
        sourceVersionId: snapshot.id,
      },
      schoolCookie,
    )
  ).model.versions[0];
  const createSchoolDraft = async (code, cookie) =>
    (await post("/api/models", 201, { code, content }, cookie)).model
      .versions[0];
  const secondSchoolDraft = await createSchoolDraft(
    "SYNC_SCHOOL_B_DRAFT",
    schoolBCookie,
  );
  const schoolReleased = await createSchoolDraft(
    "SYNC_SCHOOL_RELEASED",
    schoolCookie,
  );
  const awaitingApproval = await createSchoolDraft(
    "SYNC_SCHOOL_SUBMITTED",
    schoolBCookie,
  );
  const awaitingRejection = await createSchoolDraft(
    "SYNC_SCHOOL_REJECTED",
    schoolCookie,
  );
  await schoolTransition(schoolReleased, "submit", schoolCookie);
  const schoolSnapshot = (
    await schoolTransition(schoolReleased, "publish", reviewerCookie)
  ).version;
  await schoolTransition(awaitingApproval, "submit", schoolBCookie);
  await schoolTransition(awaitingRejection, "submit", schoolCookie);
  const archived = (
    await post("/api/admin/models", 201, {
      code: "SYNC_ARCHIVED_TEMPLATE",
      content,
    })
  ).model;
  await transition(archived.versions[0], 200);
  await expectStatus(`/api/models/${archived.id}`, 200, {
    method: "DELETE",
    cookie: adminCookie,
  });

  const dataA = {
    ...fields,
    emissionFactor: "2.38",
    carbonFootprintFactor: "2.38kgCO2e/kg",
  };
  const dataB = { ...fields, emissionFactor: "30" };
  const draftA = await nextDraft(sourceA, dataA);
  const draftB = await nextDraft(sourceB, dataB);
  const list = async (code) =>
    (
      await expectStatus(`/api/data-items?q=${code}`, 200, {
        cookie: schoolCookie,
      })
    ).entries.map(({ id }) => id);
  assert.deepEqual(await list("SYNC_A"), [sourceA.id]);
  const [resultA, resultB] = await Promise.all([
    publish(draftA, dataA),
    publish(draftB, dataB),
  ]);
  const changes = [...resultA.modelChanges, ...resultB.modelChanges];
  assert.equal(changes.filter(({ createdDraft }) => createdDraft).length, 2);
  assert.equal(changes.filter(({ updated }) => updated > 0).length, 10);
  assert.equal(
    changes.filter(({ awaitingReview }) => awaitingReview).length,
    4,
  );
  assert.deepEqual(await list("SYNC_A"), [resultA.entry.id]);
  assert.deepEqual(await list("SYNC_B"), [resultB.entry.id]);
  await post(
    "/api/models",
    400,
    { code: "SYNC_OLD_DENIED", content },
    schoolCookie,
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const versions = async (modelId) =>
      (
        await client.query(
          'SELECT id, version, status, content FROM "ModelVersion" WHERE "modelId" = $1 ORDER BY version',
          [modelId],
        )
      ).rows;
    const [updatedDraft] = await versions(editable.id);
    const [original, successor, ...unexpected] = await versions(published.id);
    assert.deepEqual(unexpected, []);
    assert.equal(updatedDraft.id, editable.versions[0].id);
    assert.equal(updatedDraft.content.description, content.description);
    assert.deepEqual(original.content, snapshot.content);
    assert.equal(successor.version, 2);
    assert.equal(successor.status, "DRAFT");
    const activeIds = [resultA.entry.id, resultB.entry.id];
    const [updatedSchoolCopy] = await versions(schoolCopy.modelId);
    const [updatedSecondSchool] = await versions(secondSchoolDraft.modelId);
    const [originalSchool, schoolSuccessor, ...extraSchoolVersions] =
      await versions(schoolReleased.modelId);
    assert.deepEqual(extraSchoolVersions, []);
    assert.deepEqual(originalSchool.content, schoolSnapshot.content);
    assert.equal(schoolSuccessor.status, "DRAFT");
    assert.equal(schoolSuccessor.version, 2);
    for (const version of [
      updatedDraft,
      successor,
      updatedSchoolCopy,
      updatedSecondSchool,
      schoolSuccessor,
    ]) {
      assert.deepEqual(sourceVersions(version), activeIds);
      assert.deepEqual(
        items(version).map(({ emissionFactor }) => emissionFactor),
        ["2.38", "30"],
      );
      assert.deepEqual(
        items(version).map(({ id }) => id),
        items(snapshot).map(({ id }) => id),
      );
      assert.equal(items(version)[0].carbonFootprintFactor, "2.38kgCO2e/kg");
    }
    const [submitted] = await versions(awaitingApproval.modelId);
    assert.equal(submitted.status, "SUBMITTED");
    assert.deepEqual(submitted.content, awaitingApproval.content);
    await schoolTransition(submitted, "publish", schoolBReviewerCookie);
    const [approved, schoolDraftAfterApproval] = await versions(
      awaitingApproval.modelId,
    );
    assert.equal(approved.status, "PUBLISHED");
    assert.deepEqual(approved.content, submitted.content);
    assert.deepEqual(sourceVersions(schoolDraftAfterApproval), activeIds);
    const rejected = (
      await schoolTransition(awaitingRejection, "reject", reviewerCookie)
    ).version;
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.reviewNote, "请核对原始资料");
    assert.deepEqual(sourceVersions(rejected), activeIds);

    // Simulate an existing school draft from before cross-school synchronization.
    const lagged = structuredClone(updatedSchoolCopy.content);
    items({ content: lagged })[0] = items(schoolCopy)[0];
    await client.query(
      'UPDATE "ModelVersion" SET content = $1::jsonb WHERE id = $2',
      [JSON.stringify(lagged), updatedSchoolCopy.id],
    );
    const runBackfill = () =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            "--conditions=react-server",
            "--import",
            "tsx",
            "scripts/sync-data-item-models.ts",
            sourceA.code,
          ],
          {
            env: { ...process.env, DATABASE_URL: databaseUrl },
            encoding: "utf8",
          },
        ).trim(),
      );
    assert.equal(runBackfill().draftsUpdated, 1);
    assert.equal(runBackfill().draftsUpdated, 0);
    assert.deepEqual(
      sourceVersions((await versions(schoolCopy.modelId))[0]),
      activeIds,
    );
    assert.equal((await versions(archived.id)).length, 1);
    await post(
      "/api/models",
      400,
      {
        code: "SYNC_DRAFT_NOT_PUBLIC",
        sourceVersionId: successor.id,
      },
      schoolCookie,
    );
    await transition(updatedDraft, 409, editable.versions[0].updatedAt);
    await expectStatus(`/api/model-versions/${updatedDraft.id}`, 409, {
      method: "PATCH",
      cookie: adminCookie,
      body: {
        ...editable.versions[0].content,
        expectedUpdatedAt: editable.versions[0].updatedAt,
      },
    });
    await transition(successor, 200);
    const newSchoolCopy = (
      await post(
        "/api/models",
        201,
        {
          code: "SYNC_SCHOOL_COPY_V2",
          sourceVersionId: snapshot.id,
        },
        schoolCookie,
      )
    ).model.versions[0];
    assert.deepEqual(sourceVersions(newSchoolCopy), activeIds);

    const newUnit = {
      ...dataA,
      functionalUnit: "t",
      carbonFootprintFactor: "2.38kgCO2e/t",
    };
    const newBoundary = {
      ...dataB,
      carbonFootprintFactor: "30kgCO2e/kg（含运输）",
    };
    const changedA = (
      await publish(await nextDraft(resultA.entry, newUnit), newUnit)
    ).entry;
    const changedB = (
      await publish(await nextDraft(resultB.entry, newBoundary), newBoundary)
    ).entry;
    const [draftRequiringReview] = await versions(editable.id);
    assert.deepEqual(sourceVersions(draftRequiringReview), activeIds);
    await transition(draftRequiringReview, 409);
    const [schoolDraftRequiringReview] = await versions(
      secondSchoolDraft.modelId,
    );
    assert.deepEqual(sourceVersions(schoolDraftRequiringReview), activeIds);
    await schoolTransition(
      schoolDraftRequiringReview,
      "submit",
      schoolBCookie,
      409,
    );

    const checked = structuredClone(draftRequiringReview);
    for (const [index, entry] of [changedA, changedB].entries())
      items(checked)[index] = catalogOccurrence(
        entry,
        items(checked)[index].id,
      );
    const { version: reviewed } = await expectStatus(
      `/api/model-versions/${checked.id}`,
      200,
      {
        method: "PATCH",
        cookie: adminCookie,
        body: checked.content,
      },
    );
    await transition(reviewed, 200, reviewed.updatedAt);
    const frozenV2 = (await versions(published.id))[1];
    assert.equal(frozenV2.status, "PUBLISHED");
    assert.deepEqual(sourceVersions(frozenV2), activeIds);
    const { rows: tracked } = await client.query(
      'SELECT "dataItemVersionId" FROM "DataItemUsage" WHERE "modelVersionId" = $1',
      [updatedDraft.id],
    );
    for (const id of [
      sourceA.id,
      sourceB.id,
      ...activeIds,
      changedA.id,
      changedB.id,
    ])
      assert.ok(tracked.some((usage) => usage.dataItemVersionId === id));
  } finally {
    await client.end();
  }
  console.log(
    "Model data item upgrades passed: public and school drafts, verified numeric corrections, concurrent publication, independent review, backfill and frozen history.",
  );
}
