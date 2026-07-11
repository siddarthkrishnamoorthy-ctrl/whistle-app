-- DropForeignKey
ALTER TABLE "drills" DROP CONSTRAINT "drills_academy_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_plans" DROP CONSTRAINT "lesson_plans_academy_id_fkey";

-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "allowed_sports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "drills" ALTER COLUMN "academy_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "lesson_plans" ALTER COLUMN "academy_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
