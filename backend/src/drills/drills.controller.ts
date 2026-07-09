import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { DrillsService } from "./drills.service";
import { CreateDrillDto } from "./dto/create-drill.dto";
import { UpdateDrillDto } from "./dto/update-drill.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("drills")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class DrillsController {
  constructor(private drillsService: DrillsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query("sportKey") sportKey?: string,
    @Query("level") level?: string,
    @Query("ageGroup") ageGroup?: string,
    @Query("search") search?: string
  ) {
    return this.drillsService.findAll(user.academyId as string, { sportKey, level, ageGroup, search });
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.drillsService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  @Roles("admin", "head_coach")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDrillDto) {
    return this.drillsService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "head_coach")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateDrillDto) {
    return this.drillsService.update(user.academyId as string, id, dto);
  }

  @Delete(":id")
  @Roles("admin", "head_coach")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.drillsService.remove(user.academyId as string, id);
  }
}
