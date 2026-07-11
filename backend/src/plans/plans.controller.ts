import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { LinkClassDto } from "./dto/link-class.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("plans")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.plansService.findAll(user.academyId as string);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.plansService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlanDto) {
    return this.plansService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(user.academyId as string, id, dto);
  }

  @Delete(":id")
  @Roles("admin", "account_manager")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Query("force") force?: string) {
    return this.plansService.remove(user.academyId as string, id, force === "true");
  }

  @Post(":id/link-class")
  @Roles("admin", "account_manager")
  linkClass(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: LinkClassDto) {
    return this.plansService.linkClass(user.academyId as string, id, dto.classId);
  }
}
