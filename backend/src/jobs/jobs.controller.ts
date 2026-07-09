import { Body, Controller, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RatingService } from "../rating/rating.service";
import { JobsService } from "./jobs.service";
import { RenewalSweepService } from "./renewal-sweep.service";

// Manual triggers for the background jobs. `?sync=1` runs the work inline and
// returns its summary — useful in dev/verification and as a fallback when
// Redis is down; without it the job is queued onto BullMQ.
@Controller("internal/jobs")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin")
export class JobsController {
  constructor(
    private jobs: JobsService,
    private sweep: RenewalSweepService,
    private rating: RatingService
  ) {}

  @Post("renewal-reminders/run")
  async runRenewalReminders(@Query("sync") sync?: string) {
    if (sync) return this.sweep.runDailySweep();
    const job = await this.jobs.enqueueRenewalSweep();
    return { queued: job.id };
  }

  @Post("rating-recalc/run")
  async runRatingRecalc(@Body("sportKey") sportKey?: string, @Query("sync") sync?: string) {
    if (sync) return this.rating.recomputeFromTransactions(sportKey);
    const job = await this.jobs.enqueueRatingRecalc(sportKey);
    return { queued: job.id };
  }
}
