import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ClassesService } from "./classes.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("classes")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.classesService.findAll(user.academyId as string);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.classesService.findOneOrThrow(user.academyId as string, id);
  }

  // Account managers act as the school's admin (2026-07): they create and
  // schedule classes, choosing the lesson-plan mode at creation.
  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassDto) {
    return this.classesService.create(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(user.academyId as string, id, dto);
  }
}
