-- AlterTable
ALTER TABLE "tournament_matches" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- Backfill: matches completed before this column existed inherit their
-- tournament's start date, so historical results land in sensible windows.
UPDATE "tournament_matches" m
SET "completed_at" = t."start_date"
FROM "tournament_events" e
JOIN "tournaments" t ON t."id" = e."tournament_id"
WHERE m."event_id" = e."id" AND m."status" = 'completed' AND m."completed_at" IS NULL;
