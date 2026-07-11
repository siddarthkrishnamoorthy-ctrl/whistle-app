import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SportsService } from "./sports.service";
import { CreateSportDto } from "./dto/create-sport.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@Controller("sports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SportsController {
  constructor(private sportsService: SportsService) {}

  @Get()
  findAll(@CurrentUser() user: { academyId?: string | null }) {
    return this.sportsService.findAll(user?.academyId ?? null);
  }

  @Post()
  @Roles("admin")
  create(@Body() dto: CreateSportDto) {
    return this.sportsService.create(dto);
  }
}
