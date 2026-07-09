import { Module } from "@nestjs/common";
import { InterschoolController } from "./interschool.controller";
import { InterschoolService } from "./interschool.service";
import { InvoicesModule } from "../invoices/invoices.module";

@Module({
  imports: [InvoicesModule],
  controllers: [InterschoolController],
  providers: [InterschoolService],
})
export class InterschoolModule {}
