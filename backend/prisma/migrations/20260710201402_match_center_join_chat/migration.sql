-- AlterTable
ALTER TABLE "interschool_events" ADD COLUMN     "max_teams" INTEGER;

-- CreateTable
CREATE TABLE "event_messages" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_messages_event_id_created_at_idx" ON "event_messages"("event_id", "created_at");

-- AddForeignKey
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "interschool_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
