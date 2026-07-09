import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateLessonPlanDto } from "./create-lesson-plan.dto";

export class UpdateLessonPlanDto extends PartialType(CreateLessonPlanDto) {
  @IsOptional()
  @IsIn(["active", "upcoming", "completed"])
  status?: string;
}
