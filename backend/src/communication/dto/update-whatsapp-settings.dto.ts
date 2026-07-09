import { IsBoolean, IsOptional } from "class-validator";

export class UpdateWhatsappSettingsDto {
  @IsOptional()
  @IsBoolean()
  automatedReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  invoiceGenerationAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  classCancellationNotices?: boolean;
}
