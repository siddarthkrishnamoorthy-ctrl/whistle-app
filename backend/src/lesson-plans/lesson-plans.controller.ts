import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { LessonPlansService } from "./lesson-plans.service";
import { CreateLessonPlanDto } from "./dto/create-lesson-plan.dto";
import { UpdateLessonPlanDto } from "./dto/update-lesson-plan.dto";
import { AssignClassDto } from "./dto/assign-class.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("lesson-plans")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class LessonPlansController {
  constructor(private lessonPlansService: LessonPlansService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return this.lessonPlansService.findAll(user.academyId as string, status);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.lessonPlansService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  @Roles("admin", "account_manager", "head_coach")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLessonPlanDto) {
    return this.lessonPlansService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager", "head_coach")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateLessonPlanDto) {
    return this.lessonPlansService.update(user.academyId as string, id, dto);
  }

  @Post(":id/assign")
  @Roles("admin", "account_manager", "head_coach")
  assign(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AssignClassDto) {
    return this.lessonPlansService.assignToClass(user.academyId as string, id, dto.classId);
  }

  @Post(":id/duplicate")
  @Roles("admin", "account_manager", "head_coach")
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.lessonPlansService.duplicate(user.academyId as string, id);
  }

  @Post(":id/complete")
  @Roles("admin", "head_coach", "coach")
  complete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.lessonPlansService.markComplete(user.academyId as string, id);
  }
}
