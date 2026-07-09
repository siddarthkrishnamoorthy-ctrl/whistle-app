import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("attendance")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "coach", "head_coach")
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser, @Query("date") date: string, @Query("centerId") centerId?: string) {
    return this.attendanceService.summary(user.academyId as string, date, centerId);
  }
}
