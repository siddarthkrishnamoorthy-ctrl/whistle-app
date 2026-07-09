import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateInvoiceDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}
