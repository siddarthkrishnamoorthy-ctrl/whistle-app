import { PartialType } from "@nestjs/mapped-types";
import { IsEnum, IsOptional } from "class-validator";
import type { ClassStatus } from "@prisma/client";
import { CreateClassDto } from "./create-class.dto";

export class UpdateClassDto extends PartialType(CreateClassDto) {
  @IsOptional()
  @IsEnum(["active", "inactive"] as ClassStatus[])
  status?: ClassStatus;
}
