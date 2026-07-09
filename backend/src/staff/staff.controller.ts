import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("staff")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.staffService.findAll(user.academyId as string);
  }

  // Own profile — the mobile apps read granted module access from here.
  // Registered before ":userId" so the static segment wins.
  @Get("me")
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.staffService.findOwn(user.sub);
  }

  @Get(":userId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    return this.staffService.findOneOrThrow(user.academyId as string, userId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffDto) {
    return this.staffService.create(user.academyId as string, dto);
  }

  @Patch(":userId")
  @Roles("admin")
  update(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(user.academyId as string, userId, dto);
  }
}
