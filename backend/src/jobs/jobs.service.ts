import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { RATING_RECALC_QUEUE, RENEWAL_REMINDERS_QUEUE } from "./queues";

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(RENEWAL_REMINDERS_QUEUE) private renewalQueue: Queue,
    @InjectQueue(RATING_RECALC_QUEUE) private ratingQueue: Queue
  ) {}

  // Registers the daily 02:00 renewal sweep. Upserting a named scheduler is
  // idempotent across restarts. Racing against a timeout keeps app bootstrap
  // from hanging when Redis is down — the API stays usable, only background
  // jobs are degraded (and the sync trigger endpoints still work).
  async onModuleInit() {
    const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5000));
    const result = await Promise.race([
      this.renewalQueue
        .upsertJobScheduler("daily-renewal-sweep", { pattern: "0 2 * * *" }, { name: "sweep" })
        .then(() => "ok" as const)
        .catch((e: Error) => e.message),
      timeout,
    ]);
    if (result === "ok") this.logger.log("Daily renewal-reminder job scheduled (02:00).");
    else this.logger.warn(`Could not register renewal-reminder schedule (Redis unavailable? ${result}).`);
  }

  enqueueRenewalSweep() {
    return this.renewalQueue.add("sweep", {});
  }

  enqueueRatingRecalc(sportKey?: string) {
    return this.ratingQueue.add("recalc", { sportKey });
  }
}
