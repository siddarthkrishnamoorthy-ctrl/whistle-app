import { IsNumber, IsString, Max, Min, MinLength } from "class-validator";

export class OverrideRatingDto {
  @IsNumber()
  @Min(2.0)
  @Max(8.0)
  rating!: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}
