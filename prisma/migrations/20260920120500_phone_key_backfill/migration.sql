-- Corrects the backfill in the previous migration (its regex was over-escaped).
UPDATE "User"
SET "phoneKey" = right(regexp_replace("phone", '[^0-9]', '', 'g'), 10)
WHERE "phone" IS NOT NULL AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 10;
