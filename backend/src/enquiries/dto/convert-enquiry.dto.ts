import { IsString } from "class-validator";

export class ConvertEnquiryDto {
  @IsString()
  planId!: string;

  @IsString()
  classId!: string;
}
