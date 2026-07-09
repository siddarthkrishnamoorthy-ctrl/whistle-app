import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { PlanType } from "@prisma/client";

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(["subscription", "trial", "one_time"] as PlanType[])
  type!: PlanType;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @IsOptional()
  @IsString()
  durationUnit?: string;

  @IsNumber()
  @Min(0)
  fee!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sessionsIncluded?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  makeupsIncluded?: number;

  @IsOptional()
  @IsBoolean()
  autoRenewDefault?: boolean;

  @IsOptional()
  @IsString()
  visibility?: string;
}
