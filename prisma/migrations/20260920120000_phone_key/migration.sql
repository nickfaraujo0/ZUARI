-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneKey" TEXT;

-- CreateIndex
CREATE INDEX "User_phoneKey_idx" ON "User"("phoneKey");


-- Backfill: last 10 digits of existing phone numbers
UPDATE "User" SET "phoneKey" = right(regexp_replace("phone", '\\D', '', 'g'), 10) WHERE "phone" IS NOT NULL AND length(regexp_replace("phone", '\\D', '', 'g')) >= 10;
