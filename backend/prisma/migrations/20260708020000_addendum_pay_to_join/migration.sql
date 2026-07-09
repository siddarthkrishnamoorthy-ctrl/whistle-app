ALTER TABLE "event_rosters" ADD COLUMN     "invoice_id" TEXT;

ALTER TABLE "interschool_events" ADD COLUMN     "pay_to_join" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price_per_head" DECIMAL(10,2);

CREATE UNIQUE INDEX "event_rosters_invoice_id_key" ON "event_rosters"("invoice_id");

ALTER TABLE "event_rosters" ADD CONSTRAINT "event_rosters_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
