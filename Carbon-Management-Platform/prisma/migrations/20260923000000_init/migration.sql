-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "School" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("schoolId","userId")
);

-- CreateTable
CREATE TABLE "PlatformRole" (
    "userId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SchoolMembership_userId_status_idx" ON "SchoolMembership"("userId", "status");

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRole" ADD CONSTRAINT "PlatformRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
