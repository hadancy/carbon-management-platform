-- CreateEnum
CREATE TYPE "AccountingRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountingReviewDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "AccountingCase" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "product" VARCHAR(200) NOT NULL,
    "currentRevisionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingRevision" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "inputRevision" INTEGER NOT NULL DEFAULT 1,
    "modelVersionId" UUID NOT NULL,
    "ruleVersionId" UUID,
    "scenario" VARCHAR(40) NOT NULL,
    "inputs" JSONB NOT NULL,
    "status" "AccountingRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "lastEditedById" UUID NOT NULL,
    "submittedById" UUID,
    "submittedRunId" UUID,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationRun" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "inputRevision" INTEGER NOT NULL,
    "requestId" VARCHAR(100) NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "engineVersion" VARCHAR(80) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "snapshots" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingReview" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "decision" "AccountingReviewDecision" NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mediaType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingCase_schoolId_createdAt_idx" ON "AccountingCase"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCase_schoolId_code_key" ON "AccountingCase"("schoolId", "code");

-- CreateIndex
CREATE INDEX "AccountingRevision_schoolId_status_createdAt_idx" ON "AccountingRevision"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingRevision_caseId_revisionNo_key" ON "AccountingRevision"("caseId", "revisionNo");

-- CreateIndex
CREATE INDEX "CalculationRun_schoolId_revisionId_createdAt_idx" ON "CalculationRun"("schoolId", "revisionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalculationRun_revisionId_requestId_key" ON "CalculationRun"("revisionId", "requestId");

-- CreateIndex
CREATE INDEX "AccountingReview_actorId_createdAt_idx" ON "AccountingReview"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingReview_revisionId_key" ON "AccountingReview"("revisionId");

-- CreateIndex
CREATE INDEX "FileAsset_schoolId_createdAt_idx" ON "FileAsset"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountingCase" ADD CONSTRAINT "AccountingCase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingCase" ADD CONSTRAINT "AccountingCase_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "AccountingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AccountingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "PublicDataVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRevision" ADD CONSTRAINT "AccountingRevision_submittedRunId_fkey" FOREIGN KEY ("submittedRunId") REFERENCES "CalculationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AccountingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReview" ADD CONSTRAINT "AccountingReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AccountingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReview" ADD CONSTRAINT "AccountingReview_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CalculationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReview" ADD CONSTRAINT "AccountingReview_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
