import { IsEmail, IsString, MinLength } from "class-validator";

// POST /auth/signup-parent (BRD 10.1) — unlike POST /auth/signup (which
// provisions a brand-new Academy owned by the signer), a parent self-registers
// into no academy at all; they join one afterward via "Link your player".
export class SignupParentDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
