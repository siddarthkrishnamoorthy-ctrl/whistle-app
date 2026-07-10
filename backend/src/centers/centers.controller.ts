import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CentersService } from "./centers.service";
import { CreateCenterDto } from "./dto/create-center.dto";
import { UpdateCenterDto } from "./dto/update-center.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("centers")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class CentersController {
  constructor(private centersService: CentersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.centersService.findAll(user.academyId as string);
  }

  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCenterDto) {
    return this.centersService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCenterDto) {
    return this.centersService.update(user.academyId as string, id, dto);
  }
}
