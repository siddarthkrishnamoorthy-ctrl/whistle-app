import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PeriodicAssessmentsService, type CycleDto, type TestDto } from "./periodic-assessments.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

// Periodic Assessment module (Assessment Module BRD v1.0). Permission matrix
// per BRD Section 5: Admin/Account Manager create tests & schedule cycles;
// Admin + coaches record results; parents see their own child's history.
@Controller()
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class PeriodicAssessmentsController {
  constructor(private service: PeriodicAssessmentsService) {}

  // ── Test Library ──────────────────────────────────────────────────────────

  @Get("assessment-tests")
  @Roles("admin", "account_manager", "head_coach", "coach")
  listTests(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listTests(user.academyId as string);
  }

  @Post("assessment-tests")
  @Roles("admin", "account_manager")
  createTest(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestDto) {
    return this.service.createTest(user.academyId as string, user.sub, dto);
  }

  @Patch("assessment-tests/:id")
  @Roles("admin", "account_manager")
  updateTest(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: Partial<TestDto>) {
    return this.service.updateTest(user.academyId as string, id, dto);
  }

  // ── Cycles ────────────────────────────────────────────────────────────────

  @Get("assessment-cycles")
  @Roles("admin", "account_manager", "head_coach", "coach")
  listCycles(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCycles(user.academyId as string);
  }

  @Post("assessment-cycles")
  @Roles("admin", "account_manager")
  createCycle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CycleDto) {
    return this.service.createCycle(user.academyId as string, dto);
  }

  @Get("assessment-cycles/due")
  @Roles("admin", "account_manager", "head_coach", "coach")
  due(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dueCycles(user.academyId as string, user.sub, user.role);
  }

  @Get("assessment-cycles/:id/roster")
  @Roles("admin", "account_manager", "head_coach", "coach")
  roster(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Query("testId") testId: string) {
    return this.service.roster(user.academyId as string, id, testId);
  }

  @Get("assessment-cycles/:id/missing")
  @Roles("admin", "account_manager", "head_coach", "coach")
  missing(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.missing(user.academyId as string, id);
  }

  // Recording is Admin + coaches only (who's actually at the test) — the
  // Account Manager schedules but does not record, per BRD Section 5.
  @Post("assessment-cycles/:id/results")
  @Roles("admin", "head_coach", "coach")
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: { testId: string; clientId: string; attempts?: number[]; status?: "absent" | "exempt" }
  ) {
    return this.service.record(user.academyId as string, user.sub, id, body);
  }

  // ── History / trend — parents restricted to their own child ──────────────

  @Get("assessment-history/:clientId")
  @Roles("admin", "account_manager", "head_coach", "coach", "parent", "student")
  history(@CurrentUser() user: AuthenticatedUser, @Param("clientId") clientId: string) {
    return this.service.history(user.academyId as string, user.sub, user.role, clientId);
  }
}
