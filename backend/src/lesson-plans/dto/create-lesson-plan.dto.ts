import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { SessionFlowStepDto } from "./session-flow-step.dto";

export class CreateLessonPlanDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  ageBand?: string;

  @IsOptional()
  @IsString()
  goals?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  targetDurationMin?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionFlowStepDto)
  sessionFlow?: SessionFlowStepDto[];
}
