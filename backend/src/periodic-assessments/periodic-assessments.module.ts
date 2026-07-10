import { Module } from "@nestjs/common";
import { PeriodicAssessmentsService } from "./periodic-assessments.service";
import { PeriodicAssessmentsController } from "./periodic-assessments.controller";

// Periodic Assessment module (Assessment Module BRD v1.0) — scheduled,
// standardized, comparable-over-time fitness/skill testing. Sits alongside
// the existing ad hoc AssessmentsModule (BRD 8.4) as a second, distinct layer.
@Module({
  controllers: [PeriodicAssessmentsController],
  providers: [PeriodicAssessmentsService],
})
export class PeriodicAssessmentsModule {}
