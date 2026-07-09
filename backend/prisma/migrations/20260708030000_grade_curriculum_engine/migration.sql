
-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "grade_id" TEXT;

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetables" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "term_label" TEXT,
    "uploaded_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_periods" (
    "id" TEXT NOT NULL,
    "timetable_id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "sport_key" TEXT NOT NULL,
    "center_id" TEXT,
    "coach_id" TEXT,
    "resolved_class_id" TEXT,

    CONSTRAINT "timetable_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_tracks" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "sport_key" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "curriculum_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_items" (
    "id" TEXT NOT NULL,
    "curriculum_track_id" TEXT NOT NULL,
    "lesson_plan_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,

    CONSTRAINT "curriculum_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sequence_progress" (
    "class_id" TEXT NOT NULL,
    "curriculum_track_id" TEXT NOT NULL,
    "next_sequence_no" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sequence_progress_pkey" PRIMARY KEY ("class_id")
);

-- CreateTable
CREATE TABLE "session_lesson_deliveries" (
    "session_id" TEXT NOT NULL,
    "curriculum_item_id" TEXT,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_lesson_deliveries_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grades_academy_id_sort_order_key" ON "grades"("academy_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_tracks_academy_id_sport_key_grade_id_key" ON "curriculum_tracks"("academy_id", "sport_key", "grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_items_lesson_plan_id_key" ON "curriculum_items"("lesson_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_items_curriculum_track_id_sequence_no_key" ON "curriculum_items"("curriculum_track_id", "sequence_no");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_resolved_class_id_fkey" FOREIGN KEY ("resolved_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_tracks" ADD CONSTRAINT "curriculum_tracks_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_tracks" ADD CONSTRAINT "curriculum_tracks_sport_key_fkey" FOREIGN KEY ("sport_key") REFERENCES "sports"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_tracks" ADD CONSTRAINT "curriculum_tracks_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_curriculum_track_id_fkey" FOREIGN KEY ("curriculum_track_id") REFERENCES "curriculum_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_lesson_plan_id_fkey" FOREIGN KEY ("lesson_plan_id") REFERENCES "lesson_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sequence_progress" ADD CONSTRAINT "class_sequence_progress_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sequence_progress" ADD CONSTRAINT "class_sequence_progress_curriculum_track_id_fkey" FOREIGN KEY ("curriculum_track_id") REFERENCES "curriculum_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_lesson_deliveries" ADD CONSTRAINT "session_lesson_deliveries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scheduled_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_lesson_deliveries" ADD CONSTRAINT "session_lesson_deliveries_curriculum_item_id_fkey" FOREIGN KEY ("curriculum_item_id") REFERENCES "curriculum_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

