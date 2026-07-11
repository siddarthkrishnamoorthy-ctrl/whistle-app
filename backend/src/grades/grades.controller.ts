import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { GradesService } from "./grades.service";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("grades")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class GradesController {
  constructor(private gradesService: GradesService) {}

  @Get()
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.gradesService.findAll(user.academyId as string);
  }

  // account_manager included (2026-07): AMs set up their school's grade
  // taxonomy alongside the timetable.
  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGradeDto) {
    return this.gradesService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(user.academyId as string, id, dto);
  }
}
