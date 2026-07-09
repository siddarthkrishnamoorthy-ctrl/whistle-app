import { IsArray, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { SalaryBasis, UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["admin", "account_manager", "venue_manager", "head_coach", "coach", "referee"];

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEmail()
  email!: string;

  // Temporary password the admin sets on the staff member's behalf — a real
  // email-invite flow (TDD 4.1 POST /auth/invite-accept) needs an email
  // service this pass doesn't have; the staff member can change it after
  // logging in once that flow exists.
  @IsString()
  @MinLength(6)
  temporaryPassword!: string;

  @IsEnum(STAFF_ROLES)
  role!: UserRole;

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
  @IsEnum(["fixed", "session", "days_present"] as SalaryBasis[])
  salaryBasis?: SalaryBasis;

  @IsOptional()
  @IsNumber()
  salaryAmount?: number;

  // App modules this staff member may access (empty/omitted = everything the
  // role allows). Lets an admin hand the scoring module to a coach.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleAccess?: string[];
}
