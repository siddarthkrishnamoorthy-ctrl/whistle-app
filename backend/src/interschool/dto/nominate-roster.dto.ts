import { IsString } from "class-validator";

export class NominateRosterDto {
  @IsString()
  sportKey!: string;

  @IsString()
  clientId!: string;
}
