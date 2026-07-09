-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'referee';

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "school_id" TEXT;

-- AlterTable
ALTER TABLE "interschool_events" ADD COLUMN     "is_lbl" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "scheduled_sessions" ADD COLUMN     "checkin_biometric" BOOLEAN,
ADD COLUMN     "checkin_distance_m" INTEGER,
ADD COLUMN     "checkin_lat" DECIMAL(9,6),
ADD COLUMN     "checkin_lng" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "module_access" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "lesson_plan_assignment_mode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lbl_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "amount" DECIMAL(10,2),
    "registered_by" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lbl_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lbl_registrations_event_id_academy_id_sport_key_key" ON "lbl_registrations"("event_id", "academy_id", "sport_key");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lbl_registrations" ADD CONSTRAINT "lbl_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "interschool_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lbl_registrations" ADD CONSTRAINT "lbl_registrations_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
