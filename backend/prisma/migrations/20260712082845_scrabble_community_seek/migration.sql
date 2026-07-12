-- CreateTable
CREATE TABLE "scrabble_seeks" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "match_type" TEXT NOT NULL DEFAULT 'async',
    "status" TEXT NOT NULL DEFAULT 'open',
    "game_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrabble_seeks_pkey" PRIMARY KEY ("id")
);
