import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { RenewalsService } from "./renewals.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("renewals")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "coach", "head_coach")
export class RenewalsController {
  constructor(private renewalsService: RenewalsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return this.renewalsService.findAll(user.academyId as string, status);
  }

  @Post(":enrollmentId/renew")
  renew(@CurrentUser() user: AuthenticatedUser, @Param("enrollmentId") enrollmentId: string) {
    return this.renewalsService.renew(user.academyId as string, enrollmentId);
  }
}
