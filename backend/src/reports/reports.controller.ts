import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("reports")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("attendance-summary")
  attendanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("centerId") centerId?: string
  ) {
    return this.reportsService.attendanceSummary(user.academyId as string, from, to, centerId);
  }

  @Get("revenue")
  revenue(@CurrentUser() user: AuthenticatedUser, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.revenue(user.academyId as string, from, to);
  }

  @Get("performance")
  performance(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("sportKey") sportKey?: string,
    @Query("level") level?: string
  ) {
    return this.reportsService.performance(user.academyId as string, from, to, sportKey, level);
  }

  @Get("enquiry-conversion")
  enquiryConversion(@CurrentUser() user: AuthenticatedUser, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.enquiryConversion(user.academyId as string, from, to);
  }

  @Get("renewal-churn")
  renewalChurn(@CurrentUser() user: AuthenticatedUser, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.renewalChurn(user.academyId as string, from, to);
  }

  @Get("expense")
  expense() {
    return this.reportsService.expense();
  }

  // Platform-wide enrollment ("as a company, how many academies/schools are
  // on Whistle") — shown on the admin dashboard. Admin-only.
  @Get("platform-enrollment")
  @Roles("admin")
  platformEnrollment(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.platformEnrollment(user.academyId as string);
  }
}
