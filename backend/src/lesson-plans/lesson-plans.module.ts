import { Module } from "@nestjs/common";
import { LessonPlansController } from "./lesson-plans.controller";
import { LessonPlansService } from "./lesson-plans.service";
import { SemestersModule } from "../semesters/semesters.module";

@Module({
  imports: [SemestersModule],
  controllers: [LessonPlansController],
  providers: [LessonPlansService],
  exports: [LessonPlansService],
})
export class LessonPlansModule {}
