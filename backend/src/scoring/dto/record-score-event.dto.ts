import { IsDateString, IsObject, IsOptional, IsString } from "class-validator";

export class RecordScoreEventDto {
  // Client-generated idempotency key so a retried/offline-queued submission
  // never double-counts a tap (BRD 12.6: "must reconcile without data loss").
  @IsString()
  clientEventId!: string;

  @IsString()
  actionType!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsDateString()
  clientTimestamp!: string;
}
