import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ScheduleService } from "./schedule.service";
import { GenerateSessionsDto } from "./dto/generate-sessions.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { StartSessionDto } from "./dto/start-session.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("schedule")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

  @Get()
  findForDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query("date") date?: string,
    @Query("centerId") centerId?: string
  ) {
    return this.scheduleService.findForDate(user.academyId as string, date, centerId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scheduleService.findOneOrThrow(user.academyId as string, id);
  }

  @Post("generate")
  @Roles("admin")
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateSessionsDto) {
    return this.scheduleService.generateSessions(user.academyId as string, dto);
  }

  @Post(":id/start")
  @Roles("admin", "coach", "head_coach")
  start(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: StartSessionDto) {
    return this.scheduleService.start(user.academyId as string, id, { role: user.role }, dto);
  }

  @Post(":id/complete")
  @Roles("admin", "coach", "head_coach")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("oneOff") oneOff?: boolean
  ) {
    return this.scheduleService.complete(user.academyId as string, id, oneOff ?? false);
  }

  @Post(":id/attendance")
  @Roles("admin", "coach", "head_coach")
  markAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: MarkAttendanceDto
  ) {
    return this.scheduleService.markAttendance(user.academyId as string, id, dto, user.sub);
  }
}
