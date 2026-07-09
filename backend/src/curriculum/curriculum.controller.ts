import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";
import { CreateTrackDto } from "./dto/create-track.dto";
import { AddItemDto } from "./dto/add-item.dto";
import { ReorderItemsDto } from "./dto/reorder-items.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller()
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class CurriculumController {
  constructor(private curriculumService: CurriculumService) {}

  @Get("curriculum-tracks")
  @Roles("admin", "head_coach", "coach")
  findTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Query("sportKey") sportKey?: string,
    @Query("gradeId") gradeId?: string
  ) {
    return this.curriculumService.findTracks(user.academyId as string, sportKey, gradeId);
  }

  @Post("curriculum-tracks")
  @Roles("admin", "head_coach")
  createTrack(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTrackDto) {
    return this.curriculumService.createTrack(user.academyId as string, dto);
  }

  @Post("curriculum-tracks/:id/items")
  @Roles("admin", "head_coach")
  addItem(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AddItemDto) {
    return this.curriculumService.addItem(user.academyId as string, id, dto);
  }

  @Patch("curriculum-tracks/:id/items/reorder")
  @Roles("admin", "head_coach")
  reorderItems(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReorderItemsDto) {
    return this.curriculumService.reorderItems(user.academyId as string, id, dto);
  }

  @Delete("curriculum-tracks/:id/items/:itemId")
  @Roles("admin", "head_coach")
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string
  ) {
    return this.curriculumService.removeItem(user.academyId as string, id, itemId);
  }

  @Get("classes/:id/next-lesson")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
  nextLesson(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.curriculumService.nextLesson(user.academyId as string, id);
  }

  @Get("classes/:id/syllabus-progress")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
  syllabusProgress(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.curriculumService.syllabusProgress(user.academyId as string, id);
  }
}
