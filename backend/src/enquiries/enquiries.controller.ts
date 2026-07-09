import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { EnquiriesService } from "./enquiries.service";
import { CreateEnquiryDto } from "./dto/create-enquiry.dto";
import { UpdateEnquiryDto } from "./dto/update-enquiry.dto";
import { ConvertEnquiryDto } from "./dto/convert-enquiry.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

// Coaches are deliberately excluded — enquiries are a front-desk/sales
// concern, not a coaching one (product direction 2026-07).
@Controller("enquiries")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "head_coach")
export class EnquiriesController {
  constructor(private enquiriesService: EnquiriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query("stage") stage?: string) {
    return this.enquiriesService.findAll(user.academyId as string, stage);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.enquiriesService.findOneOrThrow(user.academyId as string, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEnquiryDto) {
    return this.enquiriesService.create(user.academyId as string, dto, user.sub);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateEnquiryDto) {
    return this.enquiriesService.update(user.academyId as string, id, dto);
  }

  @Post(":id/convert")
  convert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ConvertEnquiryDto) {
    return this.enquiriesService.convertToClient(user.academyId as string, id, dto);
  }
}
