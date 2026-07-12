-- AlterTable
ALTER TABLE "chess_games" ADD COLUMN     "bot_level" INTEGER;

-- CreateTable
CREATE TABLE "chess_puzzles" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "solution" TEXT[],
    "theme" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chess_puzzles_pkey" PRIMARY KEY ("id")
);
