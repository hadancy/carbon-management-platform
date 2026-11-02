import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
export async function verifyLoad({
  databaseUrl,
  baseURL,
  schoolCookie,
  schoolBCookie,
  accountingPath,
  pdfPath,
}) {
  assert.match(new URL(databaseUrl).pathname, /^\/carbon_stage3_[a-f0-9]+$/);
  const amount = Number(process.env.LOAD_CASES ?? 500);
  const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 20);
  const requests = Number(process.env.LOAD_REQUESTS ?? 200);
  for (const [value, max] of [
    [amount, 10000],
    [concurrency, 100],
    [requests, 5000],
  ])
    assert.ok(
      Number.isSafeInteger(value) && value >= 1 && value <= max,
      "Load settings outside rehearsal bounds",
    );
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let seeded = [];
  try {
    const id = accountingPath.split("/").at(-1);
    const original = (
      await client.query('SELECT * FROM "AccountingCase" WHERE id=$1', [id])
    ).rows[0];
    const revision = (
      await client.query('SELECT * FROM "AccountingRevision" WHERE id=$1', [
        original.currentRevisionId,
      ])
    ).rows[0];
    await client.query("BEGIN");
    for (let index = 0; index < amount; index++) {
      const caseId = randomUUID(),
        revisionId = randomUUID();
      seeded.push(caseId);
      await client.query(
        'INSERT INTO "AccountingCase" (id,"schoolId",code,product,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())',
        [
          caseId,
          original.schoolId,
          `LOAD_${index}_${caseId.slice(0, 8)}`,
          "TEST 合成容量案例",
        ],
      );
      await client.query(
        'INSERT INTO "AccountingRevision" (id,"caseId","schoolId","revisionNo","modelVersionId","ruleVersionId",scenario,inputs,"createdById","lastEditedById","createdAt","updatedAt") VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$8,NOW(),NOW())',
        [
          revisionId,
          caseId,
          original.schoolId,
          revision.modelVersionId,
          revision.ruleVersionId,
          revision.scenario,
          JSON.stringify(revision.inputs),
          revision.createdById,
        ],
      );
      await client.query(
        'UPDATE "AccountingCase" SET "currentRevisionId"=$1 WHERE id=$2',
        [revisionId, caseId],
      );
    }
    await client.query("COMMIT");
    const durations = [];
    let failures = 0,
      next = 0,
      peakConnections = 0,
      bytes = 0;
    let sampling = false;
    let samplePromise = Promise.resolve();
    const poll = setInterval(() => {
      if (sampling) return;
      sampling = true;
      samplePromise = client
        .query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database()",
        )
        .then(({ rows }) => {
          peakConnections = Math.max(peakConnections, rows[0].count);
        })
        .catch(() => {})
        .finally(() => {
          sampling = false;
        });
    }, 100);
    const started = performance.now();
    try {
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (next < requests) {
            const index = next++;
            const endpoint =
              index % 4 === 0
                ? "/api/accounting/cases"
                : index % 4 === 1
                  ? accountingPath
                  : index % 4 === 2
                    ? "/api/reports"
                    : pdfPath;
            const start = performance.now();
            try {
              const response = await fetch(baseURL + endpoint, {
                headers: { cookie: schoolCookie },
                signal: AbortSignal.timeout(15000),
              });
              const body = await response.arrayBuffer();
              bytes += body.byteLength;
              if (response.status !== 200) failures++;
            } catch {
              failures++;
            }
            durations.push(performance.now() - start);
          }
        }),
      );
    } finally {
      clearInterval(poll);
      await samplePromise;
    }
    const elapsed = performance.now() - started;
    durations.sort((a, b) => a - b);
    const cross = await fetch(baseURL + accountingPath, {
      headers: { cookie: schoolBCookie },
    });
    assert.equal(cross.status, 404);
    assert.equal(failures, 0, "Capacity requests must all succeed");
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    assert.ok(p95 < 5000, `Local rehearsal p95 ${p95} ms exceeded 5 seconds`);
    const ready = await fetch(baseURL + "/api/ready");
    assert.equal(ready.status, 200);
    const result = {
      status: "PASSED",
      synthetic: true,
      seededCases: amount,
      concurrency,
      requests,
      failures,
      durationMs: Math.round(elapsed),
      requestsPerSecond: Number((requests / (elapsed / 1000)).toFixed(2)),
      p50Ms: Math.round(durations[Math.ceil(durations.length * 0.5) - 1]),
      p95Ms: Math.round(p95),
      maxMs: Math.round(durations.at(-1)),
      peakDatabaseConnections: peakConnections,
      responseBytes: bytes,
      endpoints: ["案例列表", "案例详情", "报告列表", "已缓存 PDF 下载"],
      scope: "本机预发布演练；正式规模和首次 PDF 渲染吞吐须在部署目标另行验收",
    };
    console.log("Synthetic capacity rehearsal passed");
    return result;
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    if (seeded.length) {
      await client.query(
        'UPDATE "AccountingCase" SET "currentRevisionId"=NULL WHERE id=ANY($1::uuid[])',
        [seeded],
      );
      await client.query(
        'DELETE FROM "AccountingRevision" WHERE "caseId"=ANY($1::uuid[])',
        [seeded],
      );
      await client.query(
        'DELETE FROM "AccountingCase" WHERE id=ANY($1::uuid[])',
        [seeded],
      );
    }
    await client.end();
  }
}
