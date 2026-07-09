import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

// POST /assessments — coach's stopwatch/rep-counter capture UI feeds these
// fields directly; every stat is optional since which ones apply depends on
// the drill (a sprint drill fills timeTakenSec/speedMps, an accuracy drill
// fills accuracyPct/errorCount, etc — BRD's Coaching Content Engine).
export class CreateAssessmentDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  drillId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeTakenSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  repsCompleted?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  speedMps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  errorCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  enduranceTimeSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  staminaIndex?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overallRating?: number;

  @IsOptional()
  @IsString()
  coachNote?: string;
}
