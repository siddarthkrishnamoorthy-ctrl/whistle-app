import { PartialType } from "@nestjs/mapped-types";
import { CreateDrillDto } from "./create-drill.dto";

export class UpdateDrillDto extends PartialType(CreateDrillDto) {}
