import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class CompleteSessionDto {
  @IsIn(["A", "B", "draw"])
  winnerSide!: "A" | "B" | "draw";

  @IsString()
  scoreDisplay!: string;

  // Normalized closeness for the margin-aware Actual Score adjustment (BRD
  // 11.4.3): 0 = razor close, 1 = blowout. Only used when the sport/event
  // has margin-aware scoring enabled; ignored otherwise.
  @IsOptional()
  @IsNumber()
  marginRatio?: number;
}
