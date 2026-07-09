-- CreateTable
CREATE TABLE "tournament_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sports" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "venues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "public_slug" TEXT NOT NULL,
    "platform_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "allow_at_venue_payment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_officials" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "tournament_officials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_events" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'individual',
    "discipline" TEXT NOT NULL DEFAULT 'match',
    "format" TEXT NOT NULL DEFAULT 'single_elim',
    "scoring_mode" TEXT,
    "standard_value" DECIMAL(10,3),
    "unit" TEXT NOT NULL DEFAULT 'sec',
    "entry_fee" DECIMAL(10,2),
    "max_entrants" INTEGER,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,

    CONSTRAINT "tournament_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_entries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "registrant_id" TEXT,
    "team_name" TEXT,
    "players" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "seed" INTEGER,
    "paid_amount" DECIMAL(10,2),
    "paid_at" TIMESTAMP(3),
    "linked_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "match_no" INTEGER NOT NULL,
    "entry_a_id" TEXT,
    "entry_b_id" TEXT,
    "next_match_id" TEXT,
    "slot_in_next" TEXT,
    "venue" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "score_a" INTEGER NOT NULL DEFAULT 0,
    "score_b" INTEGER NOT NULL DEFAULT 0,
    "score_display" TEXT,
    "winner_entry_id" TEXT,
    "official_id" TEXT,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_timed_results" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "heat" INTEGER NOT NULL DEFAULT 1,
    "phase" TEXT NOT NULL DEFAULT 'heat',
    "value" DECIMAL(10,3) NOT NULL,
    "dq" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tournament_timed_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_users_email_key" ON "tournament_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_public_slug_key" ON "tournaments"("public_slug");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_officials_tournament_id_user_id_key" ON "tournament_officials"("tournament_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_timed_results_event_id_entry_id_phase_heat_key" ON "tournament_timed_results"("event_id", "entry_id", "phase", "heat");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "tournament_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_officials" ADD CONSTRAINT "tournament_officials_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_officials" ADD CONSTRAINT "tournament_officials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tournament_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tournament_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_registrant_id_fkey" FOREIGN KEY ("registrant_id") REFERENCES "tournament_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tournament_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_timed_results" ADD CONSTRAINT "tournament_timed_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tournament_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_timed_results" ADD CONSTRAINT "tournament_timed_results_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "tournament_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
