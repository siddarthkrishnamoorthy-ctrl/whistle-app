import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

// BRD 6.1 / NFR "Zero-dependency access": no academy, school, or club
// affiliation field exists — anyone can sign up fresh, specifically for this.
export class TournamentSignupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(["organizer", "official", "registrant"])
  role!: "organizer" | "official" | "registrant";

  @IsOptional()
  @IsString()
  phone?: string;

  // Optional branding for the organizer's tournament public pages (BRD 6.1).
  @IsOptional()
  @IsString()
  organizationName?: string;
}

export class TournamentLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
