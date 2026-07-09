import { Module } from "@nestjs/common";
import { DrillsController } from "./drills.controller";
import { DrillsService } from "./drills.service";

@Module({
  controllers: [DrillsController],
  providers: [DrillsService],
  exports: [DrillsService],
})
export class DrillsModule {}
