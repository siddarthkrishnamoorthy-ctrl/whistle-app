import { PartialType } from "@nestjs/mapped-types";
import { IsEnum, IsOptional } from "class-validator";
import type { EnquiryStage } from "@prisma/client";
import { CreateEnquiryDto } from "./create-enquiry.dto";

export class UpdateEnquiryDto extends PartialType(CreateEnquiryDto) {
  @IsOptional()
  @IsEnum(["lead", "closed", "junk"] as EnquiryStage[])
  stage?: EnquiryStage;
}
