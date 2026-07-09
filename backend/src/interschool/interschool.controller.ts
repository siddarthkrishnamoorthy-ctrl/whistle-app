import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { EventStatus } from "@prisma/client";
import { InterschoolService } from "./interschool.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { InviteSchoolsDto } from "./dto/invite-schools.dto";
import { RespondInvitationDto } from "./dto/respond-invitation.dto";
import { NominateRosterDto } from "./dto/nominate-roster.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("interschool")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "referee", "parent", "student")
export class InterschoolController {
  constructor(private interschoolService: InterschoolService) {}

  @Get("settings")
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.interschoolService.getSettings(user.academyId as string);
  }

  @Patch("settings")
  @Roles("admin")
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body("networkOptIn") networkOptIn: boolean) {
    return this.interschoolService.updateSettings(user.academyId as string, networkOptIn);
  }

  @Patch("settings/reliability-score")
  @Roles("admin")
  updateReliabilityToggle(
    @CurrentUser() user: AuthenticatedUser,
    @Body("showReliabilityScore") showReliabilityScore: boolean
  ) {
    return this.interschoolService.updateReliabilityToggle(user.academyId as string, showReliabilityScore);
  }

  @Get("member-schools")
  memberSchools(@CurrentUser() user: AuthenticatedUser) {
    return this.interschoolService.memberSchools(user.academyId as string);
  }

  @Get("invitations")
  myInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.interschoolService.myInvitations(user.academyId as string);
  }

  @Post("invitations/:id/respond")
  @Roles("admin", "head_coach")
  respondInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RespondInvitationDto
  ) {
    return this.interschoolService.respondInvitation(user.academyId as string, id, dto);
  }

  // scope=discover lists published events hosted by OTHER network academies
  // (BRD 11.2 member schools) so coaches can find game days around them.
  @Get("events")
  findEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: EventStatus,
    @Query("scope") scope?: "mine" | "discover"
  ) {
    return this.interschoolService.findEvents(user.academyId as string, status, scope);
  }

  @Get("events/:id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.findOneOrThrow(user.academyId as string, id);
  }

  // Coaches can host events from the mobile app (create/update/publish/invite);
  // closing an event stays a Tournament Director action (admin/head_coach).
  @Post("events")
  @Roles("admin", "head_coach", "coach")
  createEvent(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.interschoolService.createEvent(user.academyId as string, dto);
  }

  @Patch("events/:id")
  @Roles("admin", "head_coach", "coach")
  updateEvent(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.interschoolService.updateEvent(user.academyId as string, id, dto);
  }

  @Post("events/:id/publish")
  @Roles("admin", "head_coach", "coach")
  publish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.publishEvent(user.academyId as string, id);
  }

  @Post("events/:id/close")
  @Roles("admin", "head_coach")
  close(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.closeEvent(user.academyId as string, id);
  }

  @Post("events/:id/invitations")
  @Roles("admin", "head_coach", "coach")
  invite(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: InviteSchoolsDto) {
    return this.interschoolService.inviteSchools(user.academyId as string, id, dto);
  }

  @Get("events/:id/rosters")
  listRosters(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.listRosters(user.academyId as string, id);
  }

  @Post("events/:id/rosters")
  @Roles("admin", "head_coach", "coach")
  nominate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: NominateRosterDto) {
    return this.interschoolService.nominateRoster(user.academyId as string, id, dto);
  }

  @Delete("events/:id/rosters/:rosterId")
  @Roles("admin", "head_coach")
  removeRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("rosterId") rosterId: string
  ) {
    return this.interschoolService.removeRosterEntry(user.academyId as string, id, rosterId);
  }

  @Get("events/:id/leaderboard")
  leaderboard(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.eventLeaderboard(user.academyId as string, id);
  }

  // ── LBL Tournaments (2026-07) — self-service school registration ─────────

  @Get("lbl/events")
  findLblEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.interschoolService.findLblEvents(user.academyId as string);
  }

  @Post("lbl/events/:id/register")
  @Roles("admin", "head_coach", "coach")
  registerLbl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("sports") sports: string[]
  ) {
    return this.interschoolService.registerLbl(user.academyId as string, id, sports ?? [], user.sub);
  }

  @Post("lbl/events/:id/pay")
  @Roles("admin", "head_coach", "coach")
  payLbl(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body("sportKey") sportKey: string) {
    return this.interschoolService.payLblRegistration(user.academyId as string, id, sportKey);
  }

  @Get("lbl/events/:id/registrations")
  lblRegistrations(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.lblRegistrations(user.academyId as string, id);
  }

  @Post("lbl/events/:id/generate-fixtures")
  @Roles("admin", "head_coach", "coach")
  generateLblFixtures(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.interschoolService.generateLblFixtures(user.academyId as string, id);
  }
}
