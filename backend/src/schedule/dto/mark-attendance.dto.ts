import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEnum, IsString, ValidateNested } from "class-validator";
import type { AttendanceStatus } from "@prisma/client";

class AttendanceEntryDto {
  @IsString()
  clientId!: string;

  @IsEnum(["present", "late", "absent"] as AttendanceStatus[])
  status!: AttendanceStatus;
}

export class MarkAttendanceDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}
