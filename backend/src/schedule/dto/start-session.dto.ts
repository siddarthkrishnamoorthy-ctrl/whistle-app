import { IsBoolean, IsNumber, IsOptional } from "class-validator";

// Coach venue check-in (2026-07): coordinates captured on the coach's device
// when starting a session, validated against the center's geofence, plus
// whether a device biometric (Face/fingerprint) confirmation succeeded.
export class StartSessionDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  biometricConfirmed?: boolean;
}
