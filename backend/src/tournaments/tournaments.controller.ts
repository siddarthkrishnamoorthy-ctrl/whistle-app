import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TournamentsService } from "./tournaments.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TournamentRoles } from "./tournament-roles.decorator";
import { TournamentLoginDto, TournamentSignupDto } from "./dto/tournament-auth.dto";
import {
  CreateTournamentDto,
  GenerateFixturesDto,
  QuickEntriesDto,
  RegisterEntryDto,
  ScoreMatchDto,
  TimedResultsDto,
  UpdateTournamentDto,
} from "./dto/tournament.dto";

interface TUser {
  sub: string;
  role: string;
}

// Standalone auth — open signup with zero academy affiliation (BRD 5.1).
// Deliberately NO guards of any kind here.
@Controller("tournament-auth")
export class TournamentAuthController {
  constructor(private service: TournamentsService) {}

  @Post("signup")
  signup(@Body() dto: TournamentSignupDto) {
    return this.service.signup(dto);
  }

  @Post("login")
  login(@Body() dto: TournamentLoginDto) {
    return this.service.login(dto);
  }
}

// Public microsite API — viewable without any app or account (BRD 6.6).
@Controller("tournaments/public")
export class TournamentPublicController {
  constructor(private service: TournamentsService) {}

  // Cross-organizer sport-wise player/team dashboard. Declared before the
  // :slug catch-all so "leaderboard" never resolves as a slug.
  @Get("leaderboard")
  leaderboard(@Query("sportKey") sportKey?: string) {
    return this.service.globalLeaderboard(sportKey);
  }

  @Get(":slug")
  publicPage(@Param("slug") slug: string) {
    return this.service.publicPage(slug);
  }

  // Best player + category honors of one tournament, from scores/standings.
  @Get(":slug/awards")
  awards(@Param("slug") slug: string) {
    return this.service.awards(slug);
  }
}

// Authenticated tournament routes. NOTE: AcademyRequiredGuard must never be
// applied here — tournament users have academyId: null by design.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tournaments")
export class TournamentsController {
  constructor(private service: TournamentsService) {}

  // ── Browse + registrant ──────────────────────────────────────────────────

  @Get("open")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  browseOpen() {
    return this.service.browseOpen();
  }

  @Get("my-entries")
  @TournamentRoles("t_registrant", "t_organizer", "t_official")
  myEntries(@CurrentUser() user: TUser) {
    return this.service.myEntries(user.sub);
  }

  @Post("events/:eventId/register")
  @TournamentRoles("t_registrant", "t_organizer", "t_official")
  register(@CurrentUser() user: TUser, @Param("eventId") eventId: string, @Body() dto: RegisterEntryDto) {
    return this.service.register(user.sub, eventId, dto);
  }

  @Post("entries/:entryId/pay")
  @TournamentRoles("t_registrant", "t_organizer", "t_official")
  payEntry(@CurrentUser() user: TUser, @Param("entryId") entryId: string) {
    return this.service.payEntry(user.sub, entryId);
  }

  // ── Organizer ────────────────────────────────────────────────────────────

  @Get("mine")
  @TournamentRoles("t_organizer")
  myTournaments(@CurrentUser() user: TUser, @Query("series") series?: string) {
    return this.service.myTournaments(user.sub, series === "lbl" || series === "open" ? series : undefined);
  }

  // Playable chess matches for the logged-in registrant (Chess BRD 5.7).
  @Get("my-chess-matches")
  @TournamentRoles("t_registrant", "t_organizer", "t_official")
  myChessMatches(@CurrentUser() user: TUser) {
    return this.service.myChessMatches(user.sub);
  }

  @Get("officiating")
  @TournamentRoles("t_official", "t_organizer")
  officiating(@CurrentUser() user: TUser) {
    return this.service.officiating(user.sub);
  }

  @Post()
  @TournamentRoles("t_organizer")
  create(@CurrentUser() user: TUser, @Body() dto: CreateTournamentDto) {
    return this.service.create(user.sub, dto);
  }

  @Get(":id")
  @TournamentRoles("t_organizer")
  detail(@CurrentUser() user: TUser, @Param("id") id: string) {
    return this.service.detailForOrganizer(user.sub, id);
  }

  @Patch(":id")
  @TournamentRoles("t_organizer")
  update(@CurrentUser() user: TUser, @Param("id") id: string, @Body() dto: UpdateTournamentDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Post(":id/publish")
  @TournamentRoles("t_organizer")
  publish(@CurrentUser() user: TUser, @Param("id") id: string) {
    return this.service.publish(user.sub, id);
  }

  @Post(":id/transfer")
  @TournamentRoles("t_organizer")
  transfer(@CurrentUser() user: TUser, @Param("id") id: string, @Body("email") email: string) {
    return this.service.transfer(user.sub, id, (email ?? "").trim());
  }

  @Get(":id/payment-summary")
  @TournamentRoles("t_organizer")
  paymentSummary(@CurrentUser() user: TUser, @Param("id") id: string) {
    return this.service.paymentSummary(user.sub, id);
  }

  @Post(":id/officials")
  @TournamentRoles("t_organizer")
  appointOfficial(@CurrentUser() user: TUser, @Param("id") id: string, @Body("email") email: string) {
    return this.service.appointOfficial(user.sub, id, email);
  }

  @Post("entries/:entryId/approve")
  @TournamentRoles("t_organizer")
  approveEntry(@CurrentUser() user: TUser, @Param("entryId") entryId: string, @Body("approve") approve: boolean) {
    return this.service.approveEntry(user.sub, entryId, approve !== false);
  }

  @Post("entries/:entryId/withdraw")
  @TournamentRoles("t_organizer")
  withdrawEntry(@CurrentUser() user: TUser, @Param("entryId") entryId: string) {
    return this.service.withdrawEntry(user.sub, entryId);
  }

  @Post("events/:eventId/quick-entries")
  @TournamentRoles("t_organizer")
  quickEntries(@CurrentUser() user: TUser, @Param("eventId") eventId: string, @Body() dto: QuickEntriesDto) {
    return this.service.quickEntries(user.sub, eventId, dto);
  }

  @Post("events/:eventId/fixtures")
  @TournamentRoles("t_organizer")
  generateFixtures(@CurrentUser() user: TUser, @Param("eventId") eventId: string, @Body() dto: GenerateFixturesDto) {
    return this.service.generateFixtures(user.sub, eventId, dto);
  }

  // After the league stage: build the configured playoff bracket (the
  // organizer's explicit "proceed to playoffs" confirmation).
  @Post("events/:eventId/playoffs")
  @TournamentRoles("t_organizer")
  generatePlayoffs(@CurrentUser() user: TUser, @Param("eventId") eventId: string) {
    return this.service.generatePlayoffs(user.sub, eventId);
  }

  // ── Scoring (organizer or appointed official) ────────────────────────────

  // Per-match scheduling — organizer staggers times and courts.
  @Post("matches/:matchId/schedule")
  @TournamentRoles("t_organizer")
  scheduleMatch(
    @CurrentUser() user: TUser,
    @Param("matchId") matchId: string,
    @Body() dto: { scheduledAt?: string; venue?: string }
  ) {
    return this.service.scheduleMatch(user.sub, matchId, dto);
  }

  @Post("matches/:matchId/score")
  @TournamentRoles("t_organizer", "t_official")
  scoreMatch(@CurrentUser() user: TUser, @Param("matchId") matchId: string, @Body() dto: ScoreMatchDto) {
    return this.service.scoreMatch(user.sub, user.role, matchId, dto);
  }

  @Post("events/:eventId/timed-results")
  @TournamentRoles("t_organizer", "t_official")
  recordTimedResults(@CurrentUser() user: TUser, @Param("eventId") eventId: string, @Body() dto: TimedResultsDto) {
    return this.service.recordTimedResults(user.sub, user.role, eventId, dto);
  }

  @Get("events/:eventId/ranking")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  ranking(@Param("eventId") eventId: string, @Query("phase") phase?: string) {
    return this.service.timedRanking(eventId, phase === "final" ? "final" : "heat");
  }

  @Get("events/:eventId/standings")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  standings(@Param("eventId") eventId: string) {
    return this.service.standings(eventId);
  }
}
