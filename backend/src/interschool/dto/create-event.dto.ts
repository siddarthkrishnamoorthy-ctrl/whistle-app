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
}
