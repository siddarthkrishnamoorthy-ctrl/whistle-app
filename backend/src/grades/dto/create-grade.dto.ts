import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateGradeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Optional — defaults to appending after the current highest sortOrder.
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
