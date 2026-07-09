import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class AddItemDto {
  @IsString()
  lessonPlanId!: string;

  // Optional — defaults to appending at the end (N+1).
  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceNo?: number;
}
