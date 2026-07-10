import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CricketService, type CricketBallDto } from "./cricket.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TournamentRoles } from "./tournament-roles.decorator";

interface TUser {
  sub: string;
  role: string;
}

// Cricket ball-by-ball scoring for tournament matches (Cricket Scoring
// Requirements v1.0). Reached from the /play official console and the
// organizer manage page whenever the event's sport is cricket.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tournaments/matches/:matchId/cricket")
export class CricketController {
  constructor(private cricket: CricketService) {}

  // Full derived state (innings, cards, graphs, prompts) — readable by any
  // tournament login; scoring actions below stay organizer/official-only.
  @Get()
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  state(@Param("matchId") matchId: string) {
    return this.cricket.getState(matchId);
  }

  @Get("corrections")
  @TournamentRoles("t_organizer", "t_official")
  corrections(@Param("matchId") matchId: string) {
    return this.cricket.corrections(matchId);
  }

  @Post("setup")
  @TournamentRoles("t_organizer", "t_official")
  setup(
    @CurrentUser() user: TUser,
    @Param("matchId") matchId: string,
    @Body()
    dto: { oversPerSide: number; battingFirst: "A" | "B"; playersA?: string[]; playersB?: string[]; dlsEnabled?: boolean }
  ) {
    return this.cricket.setup(user.sub, matchId, dto);
  }

  @Post("ball")
  @TournamentRoles("t_organizer", "t_official")
  ball(@CurrentUser() user: TUser, @Param("matchId") matchId: string, @Body() dto: CricketBallDto) {
    return this.cricket.recordBall(user.sub, matchId, dto);
  }

  @Post("undo")
  @TournamentRoles("t_organizer", "t_official")
  undo(@CurrentUser() user: TUser, @Param("matchId") matchId: string) {
    return this.cricket.undo(user.sub, matchId);
  }

  @Post("deliveries/:deliveryId/correct")
  @TournamentRoles("t_organizer", "t_official")
  correct(
    @CurrentUser() user: TUser,
    @Param("matchId") matchId: string,
    @Param("deliveryId") deliveryId: string,
    @Body() body: { changes: Partial<CricketBallDto>; reason: string }
  ) {
    return this.cricket.correct(user.sub, matchId, deliveryId, body.changes ?? {}, body.reason);
  }
}
