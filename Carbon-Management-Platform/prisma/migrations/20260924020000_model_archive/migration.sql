ALTER TABLE "FootprintModel" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "FootprintModel_scope_archivedAt_idx" ON "FootprintModel"("scope", "archivedAt");
DROP INDEX "FootprintModel_schoolId_code_key";
DROP INDEX "FootprintModel_public_code_key";
CREATE UNIQUE INDEX "FootprintModel_active_school_code_key" ON "FootprintModel"("schoolId", "code") WHERE "scope" = 'SCHOOL' AND "archivedAt" IS NULL;
CREATE UNIQUE INDEX "FootprintModel_active_public_code_key" ON "FootprintModel"("code") WHERE "scope" = 'PUBLIC' AND "archivedAt" IS NULL;
