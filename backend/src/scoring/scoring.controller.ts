import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import type { FixtureStatus, MatchType } from "@prisma/client";
import { ScoringService } from "./scoring.service";
import { CreateFixtureDto } from "./dto/create-fixture.dto";
import { RecordScoreEventDto } from "./dto/record-score-event.dto";
import { CompleteSessionDto } from "./dto/complete-session.dto";
import { SetPlayerStatsDto } from "./dto/set-player-stats.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
@Controller()
export class ScoringController {
  constructor(private scoringService: ScoringService) {}

  @Get("scoring-templates")
  listTemplates() {
    return this.scoringService.listTemplates();
  }

  @Get("scoring-templates/:sportKey/:formatType")
  getTemplate(@Param("sportKey") sportKey: string, @Param("formatType") formatType: "individual" | "pair" | "team") {
    return this.scoringService.getTemplate(sportKey, formatType);
  }

  @Post("scoring-templates/:sportKey/:formatType")
  @Roles("admin", "head_coach", "account_manager", "referee")
  upsertTemplate(
    @Param("sportKey") sportKey: string,
    @Param("formatType") formatType: "individual" | "pair" | "team",
    @Body() body: Record<string, unknown>
  ) {
    return this.scoringService.upsertTemplate(sportKey, formatType, body);
  }

  // A student's recent match performance (2026-07): parents see their own
  // child's Match Center contribution; staff see any student's.
  @Get("player-stats/:clientId")
  playerStats(@CurrentUser() user: AuthenticatedUser, @Param("clientId") clientId: string) {
    return this.scoringService.playerStats(user.academyId as string, user.sub, user.role, clientId);
  }

  @Get("fixtures")
  findFixtures(
    @CurrentUser() user: AuthenticatedUser,
    @Query("eventId") eventId?: string,
    @Query("status") status?: FixtureStatus,
    @Query("matchType") matchType?: MatchType
  ) {
    return this.scoringService.findFixtures(user.academyId as string, { eventId, status, matchType });
  }

  @Get("fixtures/:id")
  findFixture(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scoringService.findFixtureOrThrow(user.academyId as string, id);
  }

  @Post("fixtures")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  createFixture(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFixtureDto) {
    return this.scoringService.createFixture(user.academyId as string, dto);
  }

  @Post("fixtures/:id/abandon")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  abandon(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body("reason") reason: string) {
    return this.scoringService.abandonFixture(user.academyId as string, id, reason);
  }

  @Post("fixtures/:id/confirm")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("force") force?: boolean
  ) {
    return this.scoringService.confirmFixture(user.academyId as string, id, user.sub, force ?? false);
  }

  // Per-fixture scheduling: the host staggers match times/courts after
  // fixtures generate (service enforces host-only for event fixtures).
  @Patch("fixtures/:id/schedule")
  @Roles("admin", "head_coach", "coach", "account_manager")
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: { scheduledAt?: string; venue?: string }
  ) {
    return this.scoringService.scheduleFixture(user.academyId as string, id, dto);
  }

  @Post("fixtures/:id/manual-result")
  // "coach" included (2026-07): Match Center hosts are usually coaches — a
  // coach-entered interschool result still waits for the opponent's approval.
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  manualResult(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CompleteSessionDto) {
    return this.scoringService.enterManualResult(user.academyId as string, id, dto, {
      userId: user.sub,
      role: user.role,
      academyId: user.academyId as string,
    });
  }

  @Put("fixtures/:id/player-stats")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  setPlayerStats(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetPlayerStatsDto) {
    return this.scoringService.setPlayerStats(user.academyId as string, id, dto);
  }

  @Post("fixtures/:id/sessions")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  startSession(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scoringService.startSession(user.academyId as string, id, user.sub);
  }

  @Post("scoring-sessions/:id/events")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  recordEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RecordScoreEventDto
  ) {
    return this.scoringService.recordScoreEvent(user.academyId as string, id, dto, user.sub);
  }

  @Post("scoring-sessions/:id/undo")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  undo(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scoringService.undoLastEvent(user.academyId as string, id);
  }

  @Post("scoring-sessions/:id/pause")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  pause(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body("reason") reason?: string) {
    return this.scoringService.setPaused(user.academyId as string, id, true, reason);
  }

  @Post("scoring-sessions/:id/resume")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  resume(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scoringService.setPaused(user.academyId as string, id, false);
  }

  @Post("scoring-sessions/:id/complete")
  @Roles("admin", "head_coach", "coach", "account_manager", "referee")
  complete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CompleteSessionDto) {
    return this.scoringService.completeSession(user.academyId as string, id, dto, {
      userId: user.sub,
      role: user.role,
      academyId: user.academyId as string,
    });
  }
}
