import { IsDateString, IsString } from "class-validator";

export class GenerateSessionsDto {
  @IsString()
  classId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;
}
