-- CreateTable
CREATE TABLE "scrabble_games" (
    "id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "academy_id" TEXT,
    "bot_level" INTEGER,
    "fixture_id" TEXT,
    "tournament_match_id" TEXT,
    "player_a_id" TEXT NOT NULL,
    "player_b_id" TEXT NOT NULL,
    "player_a_name" TEXT NOT NULL,
    "player_b_name" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "moves" JSONB NOT NULL DEFAULT '[]',
    "match_type" TEXT NOT NULL DEFAULT 'async',
    "per_move_seconds" INTEGER,
    "dictionary" TEXT NOT NULL DEFAULT 'standard',
    "is_rated" BOOLEAN NOT NULL DEFAULT false,
    "score_a" INTEGER NOT NULL DEFAULT 0,
    "score_b" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winner" TEXT,
    "termination" TEXT,
    "turn_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrabble_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrabble_challenges" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "challenger_client_id" TEXT NOT NULL,
    "opponent_client_id" TEXT NOT NULL,
    "same_center" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "game_id" TEXT,
    "match_type" TEXT NOT NULL DEFAULT 'async',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrabble_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrabble_puzzles" (
    "id" TEXT NOT NULL,
    "board" JSONB NOT NULL,
    "rack" TEXT[],
    "best_word" TEXT NOT NULL,
    "best_score" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrabble_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrabble_word_lists" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "grade_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrabble_word_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrabble_word_entries" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrabble_word_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrabble_test_progress" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "word_entry_id" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrabble_test_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_blocks" (
    "id" TEXT NOT NULL,
    "blocker_client_id" TEXT NOT NULL,
    "blocked_client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrabble_games_fixture_id_key" ON "scrabble_games"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "scrabble_games_tournament_match_id_key" ON "scrabble_games"("tournament_match_id");

-- CreateIndex
CREATE UNIQUE INDEX "scrabble_test_progress_client_id_word_entry_id_key" ON "scrabble_test_progress"("client_id", "word_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_blocks_blocker_client_id_blocked_client_id_key" ON "game_blocks"("blocker_client_id", "blocked_client_id");

-- AddForeignKey
ALTER TABLE "scrabble_word_entries" ADD CONSTRAINT "scrabble_word_entries_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "scrabble_word_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
