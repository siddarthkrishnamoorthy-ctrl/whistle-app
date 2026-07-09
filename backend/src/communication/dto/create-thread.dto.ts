import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class CreateThreadDto {
  @IsIn(["direct", "group"])
  type!: "direct" | "group";

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];
}
