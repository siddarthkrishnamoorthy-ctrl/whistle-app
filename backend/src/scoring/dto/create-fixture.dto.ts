import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString } from "class-validator";

const FORMAT_TYPES = ["individual", "pair", "team"] as const;
const MATCH_TYPES = ["interschool", "internal_ladder", "practice"] as const;

export class CreateFixtureDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsString()
  sportKey!: string;

  @IsIn(FORMAT_TYPES)
  formatType!: (typeof FORMAT_TYPES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  entrantA!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  entrantB!: string[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsIn(MATCH_TYPES)
  matchType?: (typeof MATCH_TYPES)[number];
}
