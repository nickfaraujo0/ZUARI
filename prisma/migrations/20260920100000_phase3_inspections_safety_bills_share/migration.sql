-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('OPEN', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ItemResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "DelayCause" AS ENUM ('WEATHER', 'MATERIAL', 'APPROVAL', 'LABOUR', 'DESIGN', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CERTIFIED', 'INVOICED');

-- CreateEnum
CREATE TYPE "SafetyKind" AS ENUM ('INCIDENT', 'NEAR_MISS', 'HAZARD');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "escalateIssueHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "escalateTaskDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "tallyBankLedger" TEXT NOT NULL DEFAULT 'Bank Account';

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "docVersion" INTEGER,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "inspectionItemId" TEXT,
ADD COLUMN     "pinX" DOUBLE PRECISION,
ADD COLUMN     "pinY" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProgressPhoto" ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inspectionId" TEXT;

-- AlterTable
ALTER TABLE "ProgressUpdate" ADD COLUMN     "quantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "quantityDone" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quantityTotal" DOUBLE PRECISION,
ADD COLUMN     "quantityUnit" TEXT,
ADD COLUMN     "weatherSensitive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digest" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "waOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "items" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "templateId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "block" TEXT,
    "floor" TEXT,
    "locationArea" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "inspectorId" TEXT NOT NULL,
    "note" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "result" "ItemResult" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelayLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "cause" "DelayCause" NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RABill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "retentionPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "tdsPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "certifiedById" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RABill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RABillLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "prevQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RABillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientShare" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "showActivity" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "SafetyKind" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "block" TEXT,
    "floor" TEXT,
    "area" TEXT,
    "injuredCount" INTEGER NOT NULL DEFAULT 0,
    "actionsTaken" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolboxTalk" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "conductedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolboxTalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolboxAttendee" (
    "talkId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "ToolboxAttendee_pkey" PRIMARY KEY ("talkId","workerId")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "provider" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaInbound" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaInbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InspectionTemplate_companyId_idx" ON "InspectionTemplate"("companyId");

-- CreateIndex
CREATE INDEX "Inspection_projectId_status_idx" ON "Inspection"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_companyId_clientId_key" ON "Inspection"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");

-- CreateIndex
CREATE INDEX "DelayLog_projectId_date_idx" ON "DelayLog"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DelayLog_projectId_date_cause_key" ON "DelayLog"("projectId", "date", "cause");

-- CreateIndex
CREATE UNIQUE INDEX "RABill_expenseId_key" ON "RABill"("expenseId");

-- CreateIndex
CREATE INDEX "RABill_projectId_status_idx" ON "RABill"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RABill_companyId_number_key" ON "RABill"("companyId", "number");

-- CreateIndex
CREATE INDEX "RABillLine_billId_idx" ON "RABillLine"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientShare_tokenHash_key" ON "ClientShare"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientShare_projectId_idx" ON "ClientShare"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "SafetyIncident_projectId_createdAt_idx" ON "SafetyIncident"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolboxTalk_projectId_date_idx" ON "ToolboxTalk"("projectId", "date");

-- CreateIndex
CREATE INDEX "Warranty_projectId_endDate_idx" ON "Warranty"("projectId", "endDate");

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayLog" ADD CONSTRAINT "DelayLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayLog" ADD CONSTRAINT "DelayLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayLog" ADD CONSTRAINT "DelayLog_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABill" ADD CONSTRAINT "RABill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABill" ADD CONSTRAINT "RABill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABill" ADD CONSTRAINT "RABill_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABill" ADD CONSTRAINT "RABill_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABillLine" ADD CONSTRAINT "RABillLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RABillLine" ADD CONSTRAINT "RABillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "RABill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShare" ADD CONSTRAINT "ClientShare_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShare" ADD CONSTRAINT "ClientShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxTalk" ADD CONSTRAINT "ToolboxTalk_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxTalk" ADD CONSTRAINT "ToolboxTalk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxTalk" ADD CONSTRAINT "ToolboxTalk_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxAttendee" ADD CONSTRAINT "ToolboxAttendee_talkId_fkey" FOREIGN KEY ("talkId") REFERENCES "ToolboxTalk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxAttendee" ADD CONSTRAINT "ToolboxAttendee_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

