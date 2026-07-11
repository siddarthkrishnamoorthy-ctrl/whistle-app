-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "group_no" INTEGER,
ADD COLUMN     "round_label" TEXT,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'group';

-- AlterTable
ALTER TABLE "interschool_events" ADD COLUMN     "group_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "playoff_mode" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "tournament_events" ADD COLUMN     "group_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "playoff_mode" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "tournament_matches" ADD COLUMN     "group_no" INTEGER,
ADD COLUMN     "round_label" TEXT,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'group';
