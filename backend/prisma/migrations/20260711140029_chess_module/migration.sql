-- CreateTable
CREATE TABLE "chess_games" (
    "id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "academy_id" TEXT,
    "fixture_id" TEXT,
    "tournament_match_id" TEXT,
    "white_id" TEXT NOT NULL,
    "black_id" TEXT NOT NULL,
    "white_name" TEXT NOT NULL,
    "black_name" TEXT NOT NULL,
    "fen" TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    "moves" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "winner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chess_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chess_challenges" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "challenger_client_id" TEXT NOT NULL,
    "opponent_client_id" TEXT NOT NULL,
    "same_center" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "game_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chess_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chess_games_fixture_id_key" ON "chess_games"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "chess_games_tournament_match_id_key" ON "chess_games"("tournament_match_id");
