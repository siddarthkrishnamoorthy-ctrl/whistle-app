import { IsString } from "class-validator";

export class AssignClassDto {
  @IsString()
  classId!: string;
}
