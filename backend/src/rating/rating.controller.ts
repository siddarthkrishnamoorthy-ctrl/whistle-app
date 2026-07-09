import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { FormatType } from "@prisma/client";
import { RatingService } from "./rating.service";
import { OverrideRatingDto } from "./dto/override-rating.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("ratings")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
export class RatingController {
  constructor(private ratingService: RatingService) {}

  @Get("leaderboard/students")
  studentLeaderboard(
    @Query("sportKey") sportKey: string,
    @Query("formatType") formatType: FormatType,
    @Query("academyId") academyId?: string
  ) {
    return this.ratingService.studentLeaderboard(sportKey, formatType, academyId);
  }

  @Get("leaderboard/schools")
  schoolLeaderboard(@Query("sportKey") sportKey: string) {
    return this.ratingService.schoolLeaderboard(sportKey);
  }

  @Get(":clientId/:sportKey/:formatType")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
  async getRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("sportKey") sportKey: string,
    @Param("formatType") formatType: FormatType
  ) {
    await this.ratingService.assertViewableBy(user.sub, user.role, clientId);
    return this.ratingService.getOrSeedRating(clientId, sportKey, formatType);
  }

  @Get(":clientId/:sportKey/:formatType/history")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("sportKey") sportKey: string,
    @Param("formatType") formatType: FormatType
  ) {
    await this.ratingService.assertViewableBy(user.sub, user.role, clientId);
    return this.ratingService.history(clientId, sportKey, formatType);
  }

  @Post(":clientId/:sportKey/:formatType/override")
  @Roles("admin", "head_coach")
  override(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("sportKey") sportKey: string,
    @Param("formatType") formatType: FormatType,
    @Body() dto: OverrideRatingDto
  ) {
    return this.ratingService.overrideStartingRating(clientId, sportKey, formatType, dto, user.sub);
  }
}
