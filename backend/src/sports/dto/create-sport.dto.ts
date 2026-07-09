import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateSportDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  // Optional explicit key override; otherwise derived from name (see service).
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: "key must be lowercase letters, numbers and underscores only" })
  key?: string;
}
