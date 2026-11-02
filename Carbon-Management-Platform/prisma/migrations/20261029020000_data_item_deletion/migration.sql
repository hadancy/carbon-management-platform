ALTER TABLE "DataItem" ADD COLUMN "nextVersion" INTEGER NOT NULL DEFAULT 2;
UPDATE "DataItem" AS item SET "nextVersion" = versions.next
FROM (SELECT "dataItemId", greatest(2, max("version") + 1) AS next FROM "DataItemVersion" GROUP BY "dataItemId") AS versions
WHERE item.id = versions."dataItemId";
ALTER TABLE "DataItem" ADD CONSTRAINT "DataItem_nextVersion_positive" CHECK ("nextVersion" >= 2);

CREATE TABLE "DataItemUsage" (
    "dataItemVersionId" UUID NOT NULL,
    "modelVersionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataItemUsage_pkey" PRIMARY KEY ("dataItemVersionId", "modelVersionId"),
    CONSTRAINT "DataItemUsage_dataItemVersionId_fkey" FOREIGN KEY ("dataItemVersionId") REFERENCES "DataItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Retain ever-used references even when a mutable draft or its occurrence disappears.
-- Include archived models, fixed calculation snapshots and historical report sources.
WITH sources AS (
    SELECT id AS "modelVersionId", content AS document FROM "ModelVersion"
    UNION ALL
    SELECT revision."modelVersionId", run.snapshots #> '{modelVersion,content}'
    FROM "CalculationRun" run JOIN "AccountingRevision" revision ON revision.id = run."revisionId"
    UNION ALL
    SELECT revision."modelVersionId", report."sourceSnapshot" #> '{snapshot,modelVersion,content}'
    FROM "FootprintReport" report JOIN "CalculationRun" run ON run.id = report."calculationRunId"
    JOIN "AccountingRevision" revision ON revision.id = run."revisionId"
)
INSERT INTO "DataItemUsage" ("dataItemVersionId", "modelVersionId")
SELECT DISTINCT version.id, source."modelVersionId"
FROM sources source
CROSS JOIN LATERAL jsonb_path_query(coalesce(source.document, '{}'::jsonb), '$.stages[*].categories[*].items[*].librarySource.versionId') AS reference(value)
JOIN "DataItemVersion" version ON version.id::text = reference.value #>> '{}'
ON CONFLICT DO NOTHING;
