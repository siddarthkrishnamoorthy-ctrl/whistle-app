import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SportsService } from "./sports.service";
import { CreateSportDto } from "./dto/create-sport.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@Controller("sports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SportsController {
  constructor(private sportsService: SportsService) {}

  @Get()
  findAll() {
    return this.sportsService.findAll();
  }

  @Post()
  @Roles("admin")
  create(@Body() dto: CreateSportDto) {
    return this.sportsService.create(dto);
  }
}
