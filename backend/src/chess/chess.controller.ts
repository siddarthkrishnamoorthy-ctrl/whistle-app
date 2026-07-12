import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ChessService } from "./chess.service";
import { TIME_CONTROLS } from "./chess-clock";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

// Academy-side chess: friendly games between students (parents drive their
// child's account) and Match Center fixture games. Parents, coaches and
// admins can all reach the board; the service checks whose turn it is.
@Controller("chess")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "head_coach", "coach", "referee", "parent", "student")
export class ChessController {
  constructor(private chess: ChessService) {}

  @Get("opponents")
  opponents(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.chess.opponents(user.academyId as string, clientId);
  }

  @Post("challenges")
  challenge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { clientId: string; opponentClientId: string; timeControl?: string }
  ) {
    return this.chess.challenge(user.academyId as string, dto.clientId, dto.opponentClientId, dto.timeControl);
  }

  @Get("challenges")
  challenges(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.chess.challenges(user.academyId as string, clientId);
  }

  @Post("challenges/:id/respond")
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: { clientId: string; accept: boolean }
  ) {
    return this.chess.respond(user.academyId as string, id, dto.clientId, dto.accept);
  }

  @Get("games")
  myGames(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.chess.myGames(user.academyId as string, clientId);
  }

  @Get("games/:id")
  game(@Param("id") id: string) {
    return this.chess.game(id);
  }

  @Get("games/:id/legal-moves")
  async legalMoves(@Param("id") id: string, @Query("from") from: string) {
    const g = await this.chess.game(id);
    return { from, targets: this.chess.legalMoves(g.fen, from) };
  }

  @Post("games/:id/move")
  move(
    @Param("id") id: string,
    @Body() dto: { playerId: string; from: string; to: string; promotion?: string }
  ) {
    return this.chess.move(id, dto.playerId, dto.from, dto.to, dto.promotion);
  }

  @Post("games/:id/resign")
  resign(@Param("id") id: string, @Body() dto: { playerId: string }) {
    return this.chess.resign(id, dto.playerId);
  }

  // Standard time controls for the picker (BRD 5.7).
  @Get("time-controls")
  timeControls() {
    return TIME_CONTROLS.map((c) => ({ key: c.key, label: c.label }));
  }

  // ── Play vs Computer (BRD 5.1) ─────────────────────────────────────────────
  @Post("bot-games")
  createBotGame(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { clientId: string; level?: number; playerColor?: "white" | "black" | "random"; timeControl?: string }
  ) {
    return this.chess.createBotGame(
      user.academyId as string,
      dto.clientId,
      dto.level ?? 2,
      dto.playerColor ?? "white",
      dto.timeControl
    );
  }

  // ── Puzzles (BRD 5.2) ──────────────────────────────────────────────────────
  @Get("puzzles/next")
  nextPuzzle(@Query("exclude") exclude?: string) {
    return this.chess.nextPuzzle(exclude);
  }

  @Post("puzzles/:id/solve")
  solvePuzzle(@Param("id") id: string, @Body() dto: { moves: { from: string; to: string; promotion?: string }[] }) {
    return this.chess.solvePuzzle(id, dto.moves ?? []);
  }

  // Find-or-create the online board for a chess Match Center fixture.
  @Post("fixtures/:fixtureId/game")
  gameForFixture(@CurrentUser() user: AuthenticatedUser, @Param("fixtureId") fixtureId: string) {
    return this.chess.gameForFixture(user.academyId as string, fixtureId);
  }
}
