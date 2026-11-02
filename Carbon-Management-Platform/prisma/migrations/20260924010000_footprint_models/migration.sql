-- CreateEnum
CREATE TYPE "ModelScope" AS ENUM ('PUBLIC', 'SCHOOL');

-- CreateEnum
CREATE TYPE "ModelVersionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REJECTED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "FootprintModel" (
    "id" UUID NOT NULL,
    "scope" "ModelScope" NOT NULL,
    "schoolId" UUID,
    "code" VARCHAR(80) NOT NULL,
    "sourceVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FootprintModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ModelVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "lastEditedById" UUID NOT NULL,
    "submittedById" UUID,
    "reviewedById" UUID,
    "reviewNote" VARCHAR(2000),
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootprintModel_scope_createdAt_idx" ON "FootprintModel"("scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FootprintModel_schoolId_code_key" ON "FootprintModel"("schoolId", "code");

-- Public templates have no schoolId, so the composite unique index above does not cover them.
CREATE UNIQUE INDEX "FootprintModel_public_code_key" ON "FootprintModel"("code") WHERE "scope" = 'PUBLIC';

ALTER TABLE "FootprintModel" ADD CONSTRAINT "FootprintModel_scope_school_check"
CHECK (("scope" = 'PUBLIC' AND "schoolId" IS NULL AND "sourceVersionId" IS NULL)
    OR ("scope" = 'SCHOOL' AND "schoolId" IS NOT NULL));

-- CreateIndex
CREATE INDEX "ModelVersion_status_createdAt_idx" ON "ModelVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_modelId_version_key" ON "ModelVersion"("modelId", "version");

-- AddForeignKey
ALTER TABLE "FootprintModel" ADD CONSTRAINT "FootprintModel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootprintModel" ADD CONSTRAINT "FootprintModel_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "FootprintModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
