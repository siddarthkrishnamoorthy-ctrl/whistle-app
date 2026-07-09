import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SessionFlowStepDto {
  @IsInt()
  @Min(0)
  order!: number;

  @IsString()
  drillId!: string;

  @IsString()
  drillTitle!: string;

  @IsInt()
  @Min(1)
  durationMin!: number;

  @IsOptional()
  @IsString()
  category?: string;
}
