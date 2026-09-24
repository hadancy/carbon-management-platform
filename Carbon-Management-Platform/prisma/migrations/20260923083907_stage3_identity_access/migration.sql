-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PublicDataType" AS ENUM ('EMISSION_FACTOR', 'RULE_CONFIG', 'REPORT_TEMPLATE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banExpires" TIMESTAMP(3),
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "banned" BOOLEAN DEFAULT false,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "role" VARCHAR(100);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicDataVersion" (
    "id" UUID NOT NULL,
    "type" "PublicDataType" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "source" TEXT,
    "content" JSONB NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PublicDataVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "schoolId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" VARCHAR(80) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "PublicDataVersion_status_type_idx" ON "PublicDataVersion"("status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PublicDataVersion_type_code_version_key" ON "PublicDataVersion"("type", "code", "version");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicDataVersion" ADD CONSTRAINT "PublicDataVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
