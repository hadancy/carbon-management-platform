-- CreateEnum
CREATE TYPE "ReportRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FootprintReport" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "calculationRunId" UUID NOT NULL,
    "templateVersion" VARCHAR(80) NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "currentRevisionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootprintReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRevision" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "contentRevision" INTEGER NOT NULL DEFAULT 1,
    "status" "ReportRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "contentSnapshot" JSONB NOT NULL,
    "contentHash" VARCHAR(64),
    "createdById" UUID NOT NULL,
    "lastEditedById" UUID NOT NULL,
    "submittedById" UUID,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewerName" VARCHAR(120),
    "reviewReason" VARCHAR(2000),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "content" BYTEA NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootprintReport_schoolId_updatedAt_idx" ON "FootprintReport"("schoolId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FootprintReport_schoolId_code_key" ON "FootprintReport"("schoolId", "code");

-- CreateIndex
CREATE INDEX "ReportRevision_schoolId_status_updatedAt_idx" ON "ReportRevision"("schoolId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRevision_reportId_revisionNo_key" ON "ReportRevision"("reportId", "revisionNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReportExport_revisionId_key" ON "ReportExport"("revisionId");

-- CreateIndex
CREATE INDEX "ReportExport_schoolId_createdAt_idx" ON "ReportExport"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "FootprintReport" ADD CONSTRAINT "FootprintReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootprintReport" ADD CONSTRAINT "FootprintReport_calculationRunId_fkey" FOREIGN KEY ("calculationRunId") REFERENCES "CalculationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootprintReport" ADD CONSTRAINT "FootprintReport_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "ReportRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FootprintReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ReportRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
