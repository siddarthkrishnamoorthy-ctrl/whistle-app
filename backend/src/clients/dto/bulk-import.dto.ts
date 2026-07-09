import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

// One row of an uploaded student database (parsed from CSV in the browser).
export class BulkClientRowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;
}

export class BulkImportClientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkClientRowDto)
  rows!: BulkClientRowDto[];

  // Optional defaults applied to every imported student.
  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
