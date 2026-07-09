import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import type { SalaryBasis } from "@prisma/client";

export class UpdateStaffDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsString()
  reportingManagerId?: string;

  @IsOptional()
  @IsString()
  salaryBasis?: SalaryBasis;

  @IsOptional()
  @IsNumber()
  salaryAmount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleAccess?: string[];
}
