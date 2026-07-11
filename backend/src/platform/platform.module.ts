import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { PlatformBillingModule } from "../platform-billing/platform-billing.module";

@Module({
  imports: [PlatformBillingModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
