import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateSchoolDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  // How this school's coaches receive lesson plans; null inherits the
  // academy-level default from Settings.
  @IsOptional()
  @IsIn(["calendar", "grade_sequence"])
  lessonPlanAssignmentMode?: "calendar" | "grade_sequence";

  // Student allowance for this school's access — enrolling beyond this
  // count into the school's classes is rejected. Omit for unlimited.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
}
