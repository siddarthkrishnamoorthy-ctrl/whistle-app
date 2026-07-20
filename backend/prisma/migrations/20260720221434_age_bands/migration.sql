-- AlterTable
ALTER TABLE "drills" ADD COLUMN     "age_band" TEXT,
ADD COLUMN     "age_max" INTEGER,
ADD COLUMN     "age_min" INTEGER,
ADD COLUMN     "class_label" TEXT,
ADD COLUMN     "class_max" TEXT,
ADD COLUMN     "class_min" TEXT;

-- AlterTable
ALTER TABLE "lesson_plans" ADD COLUMN     "age_band" TEXT,
ADD COLUMN     "age_max" INTEGER,
ADD COLUMN     "age_min" INTEGER,
ADD COLUMN     "class_label" TEXT,
ADD COLUMN     "class_max" TEXT,
ADD COLUMN     "class_min" TEXT;
