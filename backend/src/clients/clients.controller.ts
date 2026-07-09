import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import type { SkillLevel } from "@prisma/client";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { BulkImportClientsDto } from "./dto/bulk-import.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("clients")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findAll(user.academyId as string);
  }

  @Get(":id")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.clientsService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  @Roles("admin", "account_manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.academyId as string, dto);
  }

  // Bulk student-database upload (CSV parsed client-side; up to 1000 rows).
  @Post("bulk")
  @Roles("admin", "account_manager")
  bulkImport(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkImportClientsDto) {
    return this.clientsService.bulkImport(user.academyId as string, dto);
  }

  @Patch(":id")
  @Roles("admin", "account_manager")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(user.academyId as string, id, dto);
  }

  @Get(":id/skill-levels")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
  skillLevels(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.clientsService.skillLevels(user.academyId as string, id);
  }

  @Put(":id/skill-levels/:sportKey")
  @Roles("admin", "head_coach")
  setSkillLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("sportKey") sportKey: string,
    @Body("level") level: SkillLevel
  ) {
    return this.clientsService.setSkillLevel(user.academyId as string, id, sportKey, level);
  }
}
