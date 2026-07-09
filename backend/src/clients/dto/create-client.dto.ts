import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsEmail()
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

  // Subscription details, mirroring the New Client modal (BRD 7.3.5) — a
  // client with no plan/class yet (e.g. a trial walk-in) can omit these.
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
