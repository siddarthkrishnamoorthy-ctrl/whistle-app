import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RatingModule } from "../rating/rating.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { RenewalSweepService } from "./renewal-sweep.service";
import { RatingRecalcProcessor, RenewalRemindersProcessor } from "./jobs.processors";
import { RATING_RECALC_QUEUE, RENEWAL_REMINDERS_QUEUE } from "./queues";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
    BullModule.registerQueue({ name: RENEWAL_REMINDERS_QUEUE }, { name: RATING_RECALC_QUEUE }),
    RatingModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, RenewalSweepService, RenewalRemindersProcessor, RatingRecalcProcessor],
})
export class JobsModule {}
