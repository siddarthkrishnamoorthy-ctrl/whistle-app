import { IsString } from "class-validator";

export class LinkClassDto {
  @IsString()
  classId!: string;
}
