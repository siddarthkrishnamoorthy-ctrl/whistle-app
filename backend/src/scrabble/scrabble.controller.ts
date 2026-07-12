import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ScrabbleService } from "./scrabble.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import type { Placement } from "./scrabble-engine";

// Academy-side Scrabble (Scrabble Module §5): individual play (vs-computer,
// puzzles, Word Power tests), social play (friends, community), and Match Center
// fixtures — parents drive their child's account; coaches/admins reach it too.
@Controller("scrabble")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "head_coach", "coach", "referee", "parent", "student")
export class ScrabbleController {
  constructor(private scrabble: ScrabbleService) {}

  @Get("match-types")
  matchTypes() {
    return this.scrabble.matchTypes();
  }

  @Get("opponents")
  opponents(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.scrabble.opponents(user.academyId as string, clientId);
  }

  // ── Friends (§5.4) ─────────────────────────────────────────────────────────
  @Post("challenges")
  challenge(@CurrentUser() user: AuthenticatedUser, @Body() dto: { clientId: string; opponentClientId: string; matchType?: string }) {
    return this.scrabble.challenge(user.academyId as string, dto.clientId, dto.opponentClientId, dto.matchType);
  }

  @Get("challenges")
  challenges(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.scrabble.challenges(user.academyId as string, clientId);
  }

  @Post("challenges/:id/respond")
  respond(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: { clientId: string; accept: boolean }) {
    return this.scrabble.respond(user.academyId as string, id, dto.clientId, dto.accept);
  }

  // ── Games ──────────────────────────────────────────────────────────────────
  @Get("games")
  myGames(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.scrabble.myGames(user.academyId as string, clientId);
  }

  @Get("games/:id")
  game(@Param("id") id: string, @Query("clientId") clientId?: string) {
    return this.scrabble.getGame(id, clientId);
  }

  @Post("games/:id/moves")
  move(
    @Param("id") id: string,
    @Body() dto: { playerId: string; type: "place" | "pass" | "exchange"; placements?: Placement[]; tiles?: string[] }
  ) {
    return this.scrabble.move(id, dto.playerId, { type: dto.type, placements: dto.placements, tiles: dto.tiles });
  }

  @Post("games/:id/resign")
  resign(@Param("id") id: string, @Body() dto: { playerId: string }) {
    return this.scrabble.resign(id, dto.playerId);
  }

  // ── Play vs Computer (§5.1) ────────────────────────────────────────────────
  @Post("games/vs-computer")
  vsComputer(@CurrentUser() user: AuthenticatedUser, @Body() dto: { clientId: string; level?: number; matchType?: string }) {
    return this.scrabble.createBotGame(user.academyId as string, dto.clientId, dto.level ?? 2, dto.matchType ?? "async");
  }

  // ── Puzzles (§5.2) ─────────────────────────────────────────────────────────
  @Get("puzzles/next")
  nextPuzzle(@Query("exclude") exclude?: string) {
    return this.scrabble.nextPuzzle(exclude);
  }

  @Post("puzzles/:id/attempt")
  attemptPuzzle(@Param("id") id: string, @Body() dto: { placements: Placement[] }) {
    return this.scrabble.attemptPuzzle(id, dto.placements ?? []);
  }

  // ── Word Power tests (§5.3) ────────────────────────────────────────────────
  @Get("word-lists")
  wordLists(@CurrentUser() user: AuthenticatedUser) {
    return this.scrabble.wordLists(user.academyId as string);
  }

  @Get("word-lists/:id")
  wordList(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.scrabble.getWordList(user.academyId as string, id);
  }

  // Word-list authoring (admin / head coach / account manager).
  @Post("word-lists")
  @Roles("admin", "head_coach", "account_manager")
  createWordList(@CurrentUser() user: AuthenticatedUser, @Body() dto: { title: string; description?: string; gradeKey?: string }) {
    return this.scrabble.createWordList(user.academyId as string, dto);
  }

  @Post("word-lists/:id/entries")
  @Roles("admin", "head_coach", "account_manager")
  addWordEntry(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: { word: string; definition: string; example?: string }) {
    return this.scrabble.addWordEntry(user.academyId as string, id, dto);
  }

  @Post("word-lists/:id/entries/:entryId/delete")
  @Roles("admin", "head_coach", "account_manager")
  deleteWordEntry(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("entryId") entryId: string) {
    return this.scrabble.deleteWordEntry(user.academyId as string, id, entryId);
  }

  @Post("tests/start")
  startTest(@Body() dto: { clientId: string; listId: string }) {
    return this.scrabble.startTest(dto.clientId, dto.listId);
  }

  @Get("tests/due")
  dueTests(@Query("clientId") clientId: string) {
    return this.scrabble.dueTests(clientId);
  }

  @Post("tests/:wordEntryId/answer")
  answerTest(@Param("wordEntryId") wordEntryId: string, @Body() dto: { clientId: string; correct: boolean }) {
    return this.scrabble.answerTest(dto.clientId, wordEntryId, dto.correct);
  }

  // ── Community open-seek (§5.5) ─────────────────────────────────────────────
  @Post("community/seek")
  seek(@CurrentUser() user: AuthenticatedUser, @Body() dto: { clientId: string; matchType?: string }) {
    return this.scrabble.seek(user.academyId as string, dto.clientId, dto.matchType);
  }

  @Get("community/seek")
  seekStatus(@CurrentUser() user: AuthenticatedUser, @Query("clientId") clientId: string) {
    return this.scrabble.seekStatus(user.academyId as string, clientId);
  }

  @Post("community/seek/cancel")
  cancelSeek(@Body() dto: { clientId: string }) {
    return this.scrabble.cancelSeek(dto.clientId);
  }

  // ── Word Rush (§5.2) ───────────────────────────────────────────────────────
  @Get("word-rush/new")
  wordRushNew() {
    return this.scrabble.wordRushNew();
  }

  @Post("word-rush/check")
  wordRushCheck(@Body() dto: { rack: string[]; word: string }) {
    return this.scrabble.wordRushCheck(dto.rack ?? [], dto.word ?? "");
  }

  // ── Safety (§5.10) ─────────────────────────────────────────────────────────
  @Post("blocks")
  block(@CurrentUser() user: AuthenticatedUser, @Body() dto: { clientId: string; blockedClientId: string }) {
    return this.scrabble.block(user.academyId as string, dto.clientId, dto.blockedClientId);
  }

  // ── Rating (§5.8) ──────────────────────────────────────────────────────────
  @Get("rating/:clientId")
  rating(@Param("clientId") clientId: string) {
    return this.scrabble.rating(clientId);
  }

  // ── Match Center fixture board (§5.7) ──────────────────────────────────────
  @Post("fixtures/:fixtureId/game")
  async gameForFixture(@CurrentUser() user: AuthenticatedUser, @Param("fixtureId") fixtureId: string, @Body() dto: { clientId?: string }) {
    const g = await this.scrabble.gameForFixture(user.academyId as string, fixtureId);
    return this.scrabble.view(g, dto?.clientId);
  }
}
