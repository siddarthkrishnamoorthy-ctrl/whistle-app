import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

// POST /auth/signup (BRD 7.1, TDD 4.1) — creates an Academy owner account:
// Academy + admin User. Staff/coach accounts are created via invite instead
// (see invite-accept.dto.ts).
export class SignupDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Addendum v3 5.2 — self-serve signup wizard's declared student strength,
  // used to provision the Academy's PlatformSubscription (Whistle's own
  // billing of the academy) at the right pricing tier from day one. Optional
  // so the pre-addendum signup flow (no wizard step for this yet) still works.
  @IsOptional()
  @IsInt()
  @Min(1)
  declaredStrength?: number;
}
