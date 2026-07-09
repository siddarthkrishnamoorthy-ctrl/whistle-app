import { ArrayNotEmpty, IsArray, IsIn, IsString, Matches } from "class-validator";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ClassTimingDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(DAYS, { each: true })
  days!: string[];

  @IsString()
  @Matches(TIME_PATTERN, { message: "startTime must be HH:mm" })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: "endTime must be HH:mm" })
  endTime!: string;
}
