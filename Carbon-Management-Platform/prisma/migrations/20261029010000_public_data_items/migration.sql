CREATE TABLE "DataItem" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataItemVersion" (
    "id" UUID NOT NULL,
    "dataItemId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "dataName" VARCHAR(200) NOT NULL,
    "specModel" VARCHAR(200) NOT NULL DEFAULT '',
    "manufacturer" VARCHAR(200) NOT NULL DEFAULT '',
    "carbonFootprintFactor" VARCHAR(120) NOT NULL DEFAULT '',
    "functionalUnit" VARCHAR(120) NOT NULL DEFAULT '',
    "emissionFactor" VARCHAR(120) NOT NULL DEFAULT '',
    "factorSource" VARCHAR(300) NOT NULL DEFAULT '',
    "dataSource" VARCHAR(300) NOT NULL DEFAULT '',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "retirementReason" VARCHAR(1000),
    CONSTRAINT "DataItemVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DataItemVersion_positive_versions" CHECK ("version" > 0 AND "revision" > 0),
    CONSTRAINT "DataItemVersion_publication" CHECK (
        ("status" = 'DRAFT' AND "publishedAt" IS NULL AND "retiredAt" IS NULL)
        OR ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL
            AND length(trim("dataName")) > 0 AND length(trim("functionalUnit")) > 0)
    ),
    CONSTRAINT "DataItemVersion_retirement" CHECK (
        "retiredAt" IS NULL OR ("retirementReason" IS NOT NULL AND length(trim("retirementReason")) > 0)
    )
);

CREATE UNIQUE INDEX "DataItem_code_key" ON "DataItem"("code");
CREATE UNIQUE INDEX "DataItemVersion_dataItemId_version_key" ON "DataItemVersion"("dataItemId", "version");
-- 同一个数据项最多维护一份未发布草稿，避免并发创建分叉版本。
CREATE UNIQUE INDEX "DataItemVersion_one_draft" ON "DataItemVersion"("dataItemId") WHERE "status" = 'DRAFT';
CREATE INDEX "DataItemVersion_status_retiredAt_createdAt_idx" ON "DataItemVersion"("status", "retiredAt", "createdAt");
CREATE INDEX "DataItemVersion_functionalUnit_status_idx" ON "DataItemVersion"("functionalUnit", "status");

ALTER TABLE "DataItemVersion" ADD CONSTRAINT "DataItemVersion_dataItemId_fkey" FOREIGN KEY ("dataItemId") REFERENCES "DataItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataItemVersion" ADD CONSTRAINT "DataItemVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
