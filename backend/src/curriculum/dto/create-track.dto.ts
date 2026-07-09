import { IsOptional, IsString } from "class-validator";

export class CreateTrackDto {
  @IsString()
  sportKey!: string;

  @IsString()
  gradeId!: string;

  @IsOptional()
  @IsString()
  title?: string;
}
