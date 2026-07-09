import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateSemesterDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @IsOptional()
  @IsString()
  objective?: string;
}
