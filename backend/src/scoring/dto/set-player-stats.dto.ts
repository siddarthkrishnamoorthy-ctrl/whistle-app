import { IsArray, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class PlayerStatEntry {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsObject()
  statFields?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(1.5)
  contributionWeight?: number;
}

export class SetPlayerStatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerStatEntry)
  stats!: PlayerStatEntry[];
}
