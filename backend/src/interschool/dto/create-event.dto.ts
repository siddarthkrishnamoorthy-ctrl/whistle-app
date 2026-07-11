import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

const FORMAT_TYPES = ["individual", "pair", "team"] as const;

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sports!: string[];

  @IsIn(FORMAT_TYPES)
  formatType!: (typeof FORMAT_TYPES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ageBands!: string[];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  entryRules?: Record<string, unknown>;

  // Addendum v3 Section 3.2 — off by default; most interschool fixtures stay free.
  @IsOptional()
  @IsBoolean()
  payToJoin?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHead?: number;

  // LBL tournament (2026-07): open for self-service school registration per
  // sport instead of the invitation flow.
  @IsOptional()
  @IsBoolean()
  isLbl?: boolean;

  // Match Center (2026-07): list the event for a set number of teams —
  // joining closes at the cap and fixtures auto-generate once rosters are in.
  @IsOptional()
  @IsNumber()
  @Min(2)
  maxTeams?: number;

  // Venue — one of the host academy's centers, shown to visiting teams and
  // inherited by every generated fixture.
  @IsOptional()
  @IsString()
  venue?: string;

  // League progression (2026-07), set by the host when listing the event:
  // split the league into groups, then resolve per playoffMode — "none"
  // (table decides), "final" (top 2), "semis" (top 4, cross-group), or
  // "quarters" (top 8, World Cup cross-over).
  @IsOptional()
  @IsIn([1, 2, 4])
  groupCount?: number;

  @IsOptional()
  @IsIn(["none", "final", "semis", "quarters"])
  playoffMode?: "none" | "final" | "semis" | "quarters";
}
