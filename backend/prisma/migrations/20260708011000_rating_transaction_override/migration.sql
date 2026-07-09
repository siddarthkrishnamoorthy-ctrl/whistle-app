ALTER TABLE "rating_transactions" DROP CONSTRAINT "rating_transactions_fixture_id_fkey";

ALTER TABLE "rating_transactions" ADD COLUMN     "overridden_by" TEXT,
ADD COLUMN     "override_reason" TEXT,
ALTER COLUMN "fixture_id" DROP NOT NULL;

ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
