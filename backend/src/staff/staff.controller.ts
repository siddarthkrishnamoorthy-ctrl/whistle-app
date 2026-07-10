import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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

  // Account managers act as the school's admin on the desktop app: they can
  // onboard coaches (and referees) with DEFAULT access, but only a full admin
  // can grant module-wise access or create admin/manager accounts.
  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffDto) {
    if (user.role === "account_manager") {
      if (!["coach", "head_coach", "referee"].includes(dto.role)) {
        throw new ForbiddenException("Account managers can only add coaches and referees.");
      }
      dto.moduleAccess = []; // default access — no module-wise assignment
    }
    return this.staffService.create(user.academyId as string, dto);
  }

  @Patch(":userId")
  @Roles("admin")
  update(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(user.academyId as string, userId, dto);
  }
}
