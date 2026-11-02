-- Nullable to preserve historical reports and their frozen content hashes.
ALTER TABLE "FootprintReport" ADD COLUMN "templateSnapshot" JSONB;
CREATE INDEX "AccountingCase_schoolId_updatedAt_idx" ON "AccountingCase"("schoolId", "updatedAt");
