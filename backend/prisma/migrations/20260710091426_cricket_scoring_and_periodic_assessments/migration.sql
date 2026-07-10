-- CreateTable
CREATE TABLE "tournament_cricket_configs" (
    "match_id" TEXT NOT NULL,
    "overs_per_side" INTEGER NOT NULL,
    "batting_first" TEXT NOT NULL,
    "players_a" TEXT[],
    "players_b" TEXT[],
    "dls_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tournament_cricket_configs_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "cricket_deliveries" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "innings" INTEGER NOT NULL,
    "over_no" INTEGER NOT NULL,
    "ball_in_over" INTEGER NOT NULL,
    "batter" TEXT NOT NULL,
    "non_striker" TEXT NOT NULL,
    "bowler" TEXT NOT NULL,
    "runs_off_bat" INTEGER NOT NULL DEFAULT 0,
    "extra_type" TEXT,
    "extra_runs" INTEGER NOT NULL DEFAULT 0,
    "is_wicket" BOOLEAN NOT NULL DEFAULT false,
    "wicket_type" TEXT,
    "dismissed_batter" TEXT,
    "fielder" TEXT,
    "shot_direction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cricket_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cricket_corrections" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "corrected_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_payload" JSONB NOT NULL,
    "new_payload" JSONB NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cricket_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_tests" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "applicable_grade_ids" TEXT[],
    "metric_type" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "precision_decimals" INTEGER NOT NULL DEFAULT 0,
    "attempts_allowed" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_benchmark_zones" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "age_min" INTEGER,
    "age_max" INTEGER,
    "gender" TEXT NOT NULL DEFAULT 'any',
    "zone_name" TEXT NOT NULL,
    "threshold_low" DECIMAL(10,2),
    "threshold_high" DECIMAL(10,2),

    CONSTRAINT "assessment_benchmark_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_cycles" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "test_ids" TEXT[],
    "grade_ids" TEXT[],
    "class_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "window_start" DATE NOT NULL,
    "window_end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "next_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_results_periodic" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "best_value" DECIMAL(10,2),
    "benchmark_zone" TEXT,
    "recorded_by_id" TEXT,
    "recorded_at" TIMESTAMP(3),

    CONSTRAINT "assessment_results_periodic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_result_attempts" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_result_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cricket_deliveries_match_id_seq_idx" ON "cricket_deliveries"("match_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_results_periodic_cycle_id_test_id_client_id_key" ON "assessment_results_periodic"("cycle_id", "test_id", "client_id");

-- AddForeignKey
ALTER TABLE "tournament_cricket_configs" ADD CONSTRAINT "tournament_cricket_configs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "tournament_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cricket_deliveries" ADD CONSTRAINT "cricket_deliveries_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "tournament_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_benchmark_zones" ADD CONSTRAINT "assessment_benchmark_zones_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "assessment_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results_periodic" ADD CONSTRAINT "assessment_results_periodic_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "assessment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results_periodic" ADD CONSTRAINT "assessment_results_periodic_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "assessment_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_result_attempts" ADD CONSTRAINT "assessment_result_attempts_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "assessment_results_periodic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
