import { IsString, MinLength } from "class-validator";

export class LinkPlayerDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
