-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "ProgressUpdate" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "SiteReport" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Issue_companyId_clientId_key" ON "Issue"("companyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressUpdate_companyId_clientId_key" ON "ProgressUpdate"("companyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteReport_companyId_clientId_key" ON "SiteReport"("companyId", "clientId");

