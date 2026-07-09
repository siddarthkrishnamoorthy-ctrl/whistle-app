import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString } from "class-validator";

export class InviteSchoolsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  academyIds!: string[];

  @IsOptional()
  @IsDateString()
  responseDeadline?: string;
}
