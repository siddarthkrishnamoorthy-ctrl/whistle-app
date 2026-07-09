import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PlatformBillingService } from "./platform-billing.service";
import { DeclareStrengthDto } from "./dto/declare-strength.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller()
export class PlatformBillingController {
  constructor(private billingService: PlatformBillingService) {}

  // Public — powers the self-serve signup wizard's "pick a tier" step
  // before an account (and JWT) exists yet.
  @Get("pricing-tiers")
  listTiers() {
    return this.billingService.listTiers();
  }

  @Get("platform-subscriptions/usage")
  @UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
  @Roles("admin")
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.usage(user.academyId as string);
  }

  @Post("platform-subscriptions")
  @UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
  @Roles("admin")
  declareStrength(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeclareStrengthDto) {
    return this.billingService.declareStrength(user.academyId as string, dto);
  }

  @Post("platform-subscriptions/:id/upgrade")
  @UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
  @Roles("admin")
  upgrade(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: DeclareStrengthDto) {
    return this.billingService.upgrade(user.academyId as string, id, dto);
  }

  // Stand-in for the addendum's scheduled true-up job (5.7) — see the
  // service method's doc comment for why this is admin-triggered rather
  // than cron-driven in this environment.
  @Post("internal/billing/run-period-close")
  @UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
  @Roles("admin")
  runPeriodClose(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.runPeriodClose(user.academyId as string);
  }

  @Post("platform-invoices/:id/mark-paid")
  @UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
  @Roles("admin")
  markInvoicePaid(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.billingService.markInvoicePaid(user.academyId as string, id);
  }
}
