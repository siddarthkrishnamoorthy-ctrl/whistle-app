import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ChessService } from "./chess.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TournamentRoles } from "../tournaments/tournament-roles.decorator";

interface TUser {
  sub: string;
  role: string;
}

// Tournament-side chess: the two registrants of a chess match play online
// from /play; the engine's verdict completes the match in the bracket.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tournaments/chess")
export class TournamentChessController {
  constructor(private chess: ChessService) {}

  @Post("matches/:matchId/game")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  gameForMatch(@CurrentUser() user: TUser, @Param("matchId") matchId: string) {
    return this.chess.gameForTournamentMatch(user.sub, matchId);
  }

  @Get("games/:id")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  game(@Param("id") id: string) {
    return this.chess.game(id);
  }

  @Get("games/:id/legal-moves")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  async legalMoves(@Param("id") id: string, @Query("from") from: string) {
    const g = await this.chess.game(id);
    return { from, targets: this.chess.legalMoves(g.fen, from) };
  }

  // Moves are authenticated by the tournament login itself — the service
  // only lets the side whose turn it is (by registrant id) move.
  @Post("games/:id/move")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  move(
    @CurrentUser() user: TUser,
    @Param("id") id: string,
    @Body() dto: { from: string; to: string; promotion?: string }
  ) {
    return this.chess.move(id, user.sub, dto.from, dto.to, dto.promotion);
  }

  @Post("games/:id/resign")
  @TournamentRoles("t_organizer", "t_official", "t_registrant")
  resign(@CurrentUser() user: TUser, @Param("id") id: string) {
    return this.chess.resign(id, user.sub);
  }
}
