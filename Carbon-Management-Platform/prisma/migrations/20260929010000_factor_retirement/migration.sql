ALTER TABLE "PublicDataVersion" ADD COLUMN "retiredAt" TIMESTAMP(3);
ALTER TABLE "PublicDataVersion" ADD COLUMN "retirementReason" VARCHAR(1000);
CREATE INDEX "PublicDataVersion_type_status_retiredAt_idx" ON "PublicDataVersion"("type", "status", "retiredAt");
