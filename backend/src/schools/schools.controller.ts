import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SchoolsService } from "./schools.service";
import { CreateSchoolDto } from "./dto/create-school.dto";
import { UpdateSchoolDto } from "./dto/update-school.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("schools")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class SchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.schoolsService.findAll(user.academyId as string);
  }

  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(user.academyId as string, id, dto);
  }
}
