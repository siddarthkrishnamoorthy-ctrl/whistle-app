-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'account_manager', 'venue_manager', 'head_coach', 'coach', 'parent', 'student');

-- CreateEnum
CREATE TYPE "SalaryBasis" AS ENUM ('fixed', 'session', 'days_present');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('subscription', 'trial', 'one_time');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'elite');

-- CreateEnum
CREATE TYPE "ClassMode" AS ENUM ('offline', 'online', 'both');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('not_started', 'ongoing', 'completed');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'due', 'overdue', 'renewed', 'stopped');

-- CreateEnum
CREATE TYPE "EnquiryTemperature" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "EnquiryStage" AS ENUM ('lead', 'closed', 'junk');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "FormatType" AS ENUM ('individual', 'pair', 'team');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'scheduled', 'live', 'completed');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('pending', 'eligible', 'ineligible');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('draft', 'scheduled', 'live', 'pending_confirmation', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('interschool', 'internal_ladder', 'practice');

-- CreateEnum
CREATE TYPE "RatingConfidence" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "academies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "brand_theme" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centers" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "geo_lat" DECIMAL(9,6),
    "geo_lng" DECIMAL(9,6),
    "geo_radius_m" INTEGER DEFAULT 500,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "user_id" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary_basis" "SalaryBasis",
    "salary_amount" DECIMAL(10,2),
    "reporting_manager_id" TEXT,
    "center_id" TEXT,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "duration_value" INTEGER,
    "duration_unit" TEXT,
    "fee" DECIMAL(10,2) NOT NULL,
    "sessions_included" INTEGER,
    "makeups_included" INTEGER NOT NULL DEFAULT 0,
    "auto_renew_default" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'all',

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "level" "SkillLevel",
    "mode" "ClassMode",
    "capacity" INTEGER,
    "coach_id" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_plans" (
    "class_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,

    CONSTRAINT "class_plans_pkey" PRIMARY KEY ("class_id","plan_id")
);

-- CreateTable
CREATE TABLE "scheduled_sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'not_started',

    CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" DATE,
    "gender" TEXT,
    "photo_url" TEXT,
    "interschool_consent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_guardians" (
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "client_guardians_pkey" PRIMARY KEY ("client_id","user_id")
);

-- CreateTable
CREATE TABLE "client_skill_levels" (
    "client_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL,

    CONSTRAINT "client_skill_levels_pkey" PRIMARY KEY ("client_id","sport_key")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "sessions_used" INTEGER NOT NULL DEFAULT 0,
    "sessions_left" INTEGER,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_name" TEXT,
    "phone" TEXT,
    "sport_key" TEXT,
    "level" TEXT,
    "center_id" TEXT,
    "status" "EnquiryTemperature" NOT NULL,
    "stage" "EnquiryStage" NOT NULL DEFAULT 'lead',
    "assigned_to" TEXT,
    "follow_up_date" DATE,
    "converted_client_id" TEXT,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "client_id" TEXT,
    "staff_id" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" TEXT,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "gateway_txn_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drills" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "skill_category" TEXT,
    "age_groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "level" "SkillLevel",
    "duration_min" INTEGER,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "media" JSONB,
    "standard_parameters" JSONB,

    CONSTRAINT "drills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_weeks" INTEGER,
    "focus_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" TEXT NOT NULL,
    "class_id" TEXT,
    "semester_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "sport_key" TEXT,
    "level" TEXT,
    "target_duration_min" INTEGER,
    "session_flow" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "drill_id" TEXT,
    "recorded_by" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_taken_sec" DECIMAL(8,2),
    "reps_completed" INTEGER,
    "accuracy_pct" DECIMAL(5,2),
    "distance_m" DECIMAL(8,2),
    "speed_mps" DECIMAL(8,2),
    "error_count" INTEGER,
    "endurance_time_sec" DECIMAL(8,2),
    "stamina_index" DECIMAL(6,2),
    "overall_rating" DECIMAL(5,2),
    "coach_note" TEXT,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interschool_events" (
    "id" TEXT NOT NULL,
    "host_academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sports" TEXT[],
    "format_type" "FormatType" NOT NULL,
    "age_bands" TEXT[],
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "entry_rules" JSONB,

    CONSTRAINT "interschool_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_invitations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "invited_academy_id" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "response_deadline" DATE,

    CONSTRAINT "event_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rosters" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "eligibility_status" "EligibilityStatus" NOT NULL DEFAULT 'pending',
    "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_templates" (
    "sport_key" TEXT NOT NULL,
    "format_type" "FormatType" NOT NULL,
    "period_structure" JSONB NOT NULL,
    "score_fields" JSONB NOT NULL,
    "win_condition" JSONB NOT NULL,
    "player_stat_fields" JSONB,
    "display_format" TEXT,

    CONSTRAINT "scoring_templates_pkey" PRIMARY KEY ("sport_key","format_type")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "sport_key" TEXT NOT NULL,
    "format_type" "FormatType" NOT NULL,
    "entrant_a" TEXT[],
    "entrant_b" TEXT[],
    "scheduled_at" TIMESTAMP(3),
    "venue" TEXT,
    "match_type" "MatchType" NOT NULL DEFAULT 'practice',
    "status" "FixtureStatus" NOT NULL DEFAULT 'scheduled',
    "abandon_reason" TEXT,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_sessions" (
    "id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "format_type" TEXT NOT NULL,
    "period_state" JSONB NOT NULL DEFAULT '{}',
    "officiated_by" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "is_offline_created" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "scoring_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_events" (
    "id" TEXT NOT NULL,
    "scoring_session_id" TEXT NOT NULL,
    "client_event_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB,
    "entered_by" TEXT,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_stats" (
    "fixture_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "stat_fields" JSONB,
    "contribution_weight" DECIMAL(4,2) NOT NULL DEFAULT 1.0,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("fixture_id","client_id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "client_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "format_type" "FormatType" NOT NULL,
    "current_rating" DECIMAL(4,2) NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "is_provisional" BOOLEAN NOT NULL DEFAULT true,
    "confidence" "RatingConfidence" NOT NULL DEFAULT 'low',
    "k_factor_current" DECIMAL(4,2) NOT NULL,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("client_id","sport_key","format_type")
);

-- CreateTable
CREATE TABLE "rating_transactions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "format_type" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "pre_rating" DECIMAL(4,2) NOT NULL,
    "post_rating" DECIMAL(4,2) NOT NULL,
    "expected_score" DECIMAL(5,4) NOT NULL,
    "actual_score" DECIMAL(3,2) NOT NULL,
    "k_factor_used" DECIMAL(4,2) NOT NULL,
    "contribution_weight" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_ratings" (
    "academy_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "aggregate_rating" DECIMAL(4,2),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_ratings_pkey" PRIMARY KEY ("academy_id","sport_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "event_invitations_event_id_invited_academy_id_key" ON "event_invitations"("event_id", "invited_academy_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_rosters_event_id_client_id_sport_key_key" ON "event_rosters"("event_id", "client_id", "sport_key");

-- CreateIndex
CREATE INDEX "score_events_scoring_session_id_client_timestamp_idx" ON "score_events"("scoring_session_id", "client_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "score_events_scoring_session_id_client_event_id_key" ON "score_events"("scoring_session_id", "client_event_id");

-- CreateIndex
CREATE INDEX "rating_transactions_client_id_sport_key_created_at_idx" ON "rating_transactions"("client_id", "sport_key", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "centers" ADD CONSTRAINT "centers_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "staff_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_plans" ADD CONSTRAINT "class_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_plans" ADD CONSTRAINT "class_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_guardians" ADD CONSTRAINT "client_guardians_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_guardians" ADD CONSTRAINT "client_guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_skill_levels" ADD CONSTRAINT "client_skill_levels_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_skill_levels" ADD CONSTRAINT "client_skill_levels_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scheduled_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scheduled_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interschool_events" ADD CONSTRAINT "interschool_events_host_academy_id_fkey" FOREIGN KEY ("host_academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "interschool_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_invited_academy_id_fkey" FOREIGN KEY ("invited_academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rosters" ADD CONSTRAINT "event_rosters_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "interschool_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rosters" ADD CONSTRAINT "event_rosters_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rosters" ADD CONSTRAINT "event_rosters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_templates" ADD CONSTRAINT "scoring_templates_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "interschool_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_sessions" ADD CONSTRAINT "scoring_sessions_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_sessions" ADD CONSTRAINT "scoring_sessions_officiated_by_fkey" FOREIGN KEY ("officiated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_scoring_session_id_fkey" FOREIGN KEY ("scoring_session_id") REFERENCES "scoring_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_ratings" ADD CONSTRAINT "school_ratings_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_ratings" ADD CONSTRAINT "school_ratings_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
