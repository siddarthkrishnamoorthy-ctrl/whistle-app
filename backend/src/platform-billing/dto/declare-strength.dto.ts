import { IsIn, IsInt, Min } from "class-validator";

// POST /platform-subscriptions (Addendum v3 5.2 step 2-3: "declare strength,
// see tier + price, pay") and also used to re-declare on /upgrade.
export class DeclareStrengthDto {
  @IsInt()
  @Min(1)
  declaredStrength!: number;

  @IsIn(["monthly", "annual"])
  billingCycle!: "monthly" | "annual";
}
