ALTER TYPE "EventStatus" ADD VALUE 'closed';

ALTER TABLE "fixtures" ADD COLUMN     "result_confirmations" JSONB,
ADD COLUMN     "result_summary" JSONB;

ALTER TABLE "interschool_events" ADD COLUMN     "settings" JSONB;
