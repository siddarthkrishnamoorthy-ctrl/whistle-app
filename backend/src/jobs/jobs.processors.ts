import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { RatingService } from "../rating/rating.service";
import { RenewalSweepService } from "./renewal-sweep.service";
import { RATING_RECALC_QUEUE, RENEWAL_REMINDERS_QUEUE } from "./queues";

@Processor(RENEWAL_REMINDERS_QUEUE)
export class RenewalRemindersProcessor extends WorkerHost {
  constructor(private sweep: RenewalSweepService) {
    super();
  }

  async process(_job: Job) {
    return this.sweep.runDailySweep();
  }
}

@Processor(RATING_RECALC_QUEUE)
export class RatingRecalcProcessor extends WorkerHost {
  constructor(private rating: RatingService) {
    super();
  }

  async process(job: Job<{ sportKey?: string }>) {
    return this.rating.recomputeFromTransactions(job.data?.sportKey);
  }
}
