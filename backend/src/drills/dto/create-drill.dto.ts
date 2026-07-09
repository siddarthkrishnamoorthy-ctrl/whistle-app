import { IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { SkillLevel } from "@prisma/client";

export class CreateDrillDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  sportKey!: string;

  @IsOptional()
  @IsString()
  skillCategory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ageGroups?: string[];

  @IsOptional()
  @IsEnum(["beginner", "intermediate", "advanced", "elite"] as SkillLevel[])
  level?: SkillLevel;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  media?: { type: "video" | "diagram"; url: string }[];

  @IsOptional()
  @IsObject()
  standardParameters?: Record<string, boolean>;
}
