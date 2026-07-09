ALTER TABLE "assessments" ADD CONSTRAINT "assessments_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "drills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
