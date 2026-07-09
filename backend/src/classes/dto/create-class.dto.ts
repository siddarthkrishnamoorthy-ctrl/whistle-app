import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import type { ClassMode, SkillLevel } from "@prisma/client";
import { ClassTimingDto } from "./class-timing.dto";

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  sportKey!: string;

  @IsString()
  centerId!: string;

  @IsOptional()
  @IsEnum(["beginner", "intermediate", "advanced", "elite"] as SkillLevel[])
  level?: SkillLevel;

  @IsOptional()
  @IsEnum(["offline", "online", "both"] as ClassMode[])
  mode?: ClassMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  coachId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassTimingDto)
  timings?: ClassTimingDto[];

  // Addendum v3 Section 4.3 Mode B — Admin manually anchors a Class to a
  // Grade/Section; a pure sports-academy class simply omits these.
  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  section?: string;

  // Partner school this class is run for (2026-07); drives the per-school
  // lesson-plan mode in the coach app.
  @IsOptional()
  @IsString()
  schoolId?: string;
}
