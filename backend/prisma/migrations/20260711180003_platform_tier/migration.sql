-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'platform_owner';

-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "allowance_mode" TEXT NOT NULL DEFAULT 'true_up',
ADD COLUMN     "student_allowance" INTEGER,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "batch_id" TEXT;

-- CreateTable
CREATE TABLE "invoice_batches" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payer_name" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_batches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "invoice_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
