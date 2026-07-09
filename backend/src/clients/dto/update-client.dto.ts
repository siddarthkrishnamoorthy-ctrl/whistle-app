import { IsBoolean, IsOptional } from "class-validator";
import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateClientDto } from "./create-client.dto";

export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ["planId", "classId", "startDate"] as const)
) {
  // BRD 10.6 has parents control this from the Parent app (not yet built);
  // until then, an Admin can toggle it here on the parent's behalf — the
  // Rating Engine (BRD 11.8) requires it ON before a client can be rated.
  @IsOptional()
  @IsBoolean()
  interschoolConsent?: boolean;
}
