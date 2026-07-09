import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

// BRD 6.2 — Create Tournament wizard: basics + events + dates/venues +
// registration settings in one call (v1 wizard collapses to a single step).
export class CreateEventInputDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  sportKey!: string;

  @IsIn(["team", "individual"])
  kind!: "team" | "individual";

  @IsOptional()
  @IsIn(["match", "timed"])
  discipline?: "match" | "timed";

  // single_elim = knockout; round_robin = single league round;
  // league = double round robin (home & away) with a points table.
  @IsOptional()
  @IsIn(["round_robin", "single_elim", "league"])
  format?: "round_robin" | "single_elim" | "league";

  @IsOptional()
  @IsIn(["place", "standards"])
  scoringMode?: "place" | "standards";

  @IsOptional()
  @IsNumber()
  standardValue?: number;

  @IsOptional()
  @IsIn(["sec", "m"])
  unit?: "sec" | "m";

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxEntrants?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateTournamentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Rules & regulations free text — shown on the public page.
  @IsOptional()
  @IsString()
  rules?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sports!: string[];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venues?: string[];

  @IsOptional()
  @IsBoolean()
  allowAtVenuePayment?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEventInputDto)
  events!: CreateEventInputDto[];
}

// BRD 6.3 — team or individual registration by a Registrant (or a parent on
// behalf of a minor); the captain can register alone and fill players later.
export class RegisterEntryDto {
  @IsOptional()
  @IsString()
  teamName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  players!: { name: string; age?: number; contact?: string }[];
}

// BRD 6.3 — Quick Tournament fast path: paste a list of names, bracket now.
export class QuickEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(128)
  @IsString({ each: true })
  names!: string[];
}

// Organizer edits after creation — rules can be added or refined any time.
export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venues?: string[];

  @IsOptional()
  @IsBoolean()
  allowAtVenuePayment?: boolean;
}

export class GenerateFixturesDto {
  @IsOptional()
  @IsIn(["random", "seeded"])
  seeding?: "random" | "seeded";

  // Entry ids in seed order (1 = top seed) for the "fixed seeds / byes"
  // Playinga pattern (BRD 6.5); unlisted entries fill remaining slots.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seedOrder?: string[];
}

export class ScoreMatchDto {
  @IsInt()
  @Min(0)
  scoreA!: number;

  @IsInt()
  @Min(0)
  scoreB!: number;

  @IsOptional()
  @IsString()
  scoreDisplay?: string;

  // false = live update only (public page live score); true = final.
  @IsOptional()
  @IsBoolean()
  final?: boolean;
}

export class TimedResultsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  results!: { entryId: string; value: number; heat?: number; phase?: "heat" | "final"; dq?: boolean }[];
}
