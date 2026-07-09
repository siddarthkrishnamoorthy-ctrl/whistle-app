-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "center_id" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "link_code" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "activity_log" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "birthday" DATE,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "academy_id" TEXT NOT NULL,
ADD COLUMN     "invoice_number" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clients_link_code_key" ON "clients"("link_code");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_academy_id_invoice_number_key" ON "invoices"("academy_id", "invoice_number");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

