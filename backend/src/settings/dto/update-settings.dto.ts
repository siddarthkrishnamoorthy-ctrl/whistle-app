import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class PoliciesDto {
  @IsOptional()
  @IsIn(["always", "never", "afterNoticeWindow"])
  deductOnAbsence?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priorNoticeHours?: number;

  @IsOptional()
  @IsBoolean()
  allowMakeupSessions?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PoliciesDto)
  policies?: PoliciesDto;

  // How coaches receive lesson plans: through the scheduled class calendar,
  // or as the grade-wise sequential curriculum assigned by the admin.
  @IsOptional()
  @IsIn(["calendar", "grade_sequence"])
  lessonPlanAssignmentMode?: "calendar" | "grade_sequence";
}
