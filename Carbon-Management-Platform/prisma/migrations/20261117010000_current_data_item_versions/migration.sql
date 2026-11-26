BEGIN;

WITH current_versions AS (
    SELECT "dataItemId", max("version") AS "version"
    FROM "DataItemVersion"
    WHERE "status" = 'PUBLISHED' AND "retiredAt" IS NULL
    GROUP BY "dataItemId"
)
UPDATE "DataItemVersion" AS older
SET "retiredAt" = CURRENT_TIMESTAMP,
    "retirementReason" = format('已由 v%s 接替', current_versions."version"),
    "revision" = older."revision" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
FROM current_versions
WHERE older."dataItemId" = current_versions."dataItemId"
  AND older."version" < current_versions."version"
  AND older."status" = 'PUBLISHED'
  AND older."retiredAt" IS NULL;

CREATE UNIQUE INDEX "DataItemVersion_one_current"
    ON "DataItemVersion"("dataItemId")
    WHERE "status" = 'PUBLISHED' AND "retiredAt" IS NULL;

COMMIT;
