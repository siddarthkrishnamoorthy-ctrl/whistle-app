-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "timings" JSONB;

-- AlterTable
ALTER TABLE "lesson_plans" ADD COLUMN     "academy_id" TEXT NOT NULL,
ADD COLUMN     "goals" TEXT,
ADD COLUMN     "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "what_to_bring" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_client_id_key" ON "attendance_records"("session_id", "client_id");

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

