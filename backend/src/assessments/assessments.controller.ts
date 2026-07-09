import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AssessmentsService } from "./assessments.service";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("assessments")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class AssessmentsController {
  constructor(private assessmentsService: AssessmentsService) {}

  @Get()
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
  findForClient(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.assessmentsService.findForClient(user, user.academyId as string, clientId);
  }

  @Post()
  @Roles("admin", "head_coach", "coach")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssessmentDto) {
    return this.assessmentsService.create(user.academyId as string, dto, user.sub);
  }
}
