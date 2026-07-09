import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SemestersService } from "./semesters.service";
import { CreateSemesterDto } from "./dto/create-semester.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("semesters")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class SemestersController {
  constructor(private semestersService: SemestersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.semestersService.findAll(user.academyId as string);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.semestersService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  @Roles("admin", "head_coach")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSemesterDto) {
    return this.semestersService.create(user.academyId as string, dto);
  }
}
