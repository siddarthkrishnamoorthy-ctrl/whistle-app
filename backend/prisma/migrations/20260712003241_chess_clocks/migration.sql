-- AlterTable
ALTER TABLE "chess_challenges" ADD COLUMN     "time_control" TEXT;

-- AlterTable
ALTER TABLE "chess_games" ADD COLUMN     "black_ms" INTEGER,
ADD COLUMN     "increment_ms" INTEGER,
ADD COLUMN     "initial_ms" INTEGER,
ADD COLUMN     "turn_started_at" TIMESTAMP(3),
ADD COLUMN     "white_ms" INTEGER;
