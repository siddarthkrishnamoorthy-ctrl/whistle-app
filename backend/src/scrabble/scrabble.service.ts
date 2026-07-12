import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ScoringService } from "../scoring/scoring.service";
import { TournamentsService } from "../tournaments/tournaments.service";
import { applyPass, applyPlacement, GameState, initialState, LETTER_VALUES, Placement, randomRack } from "./scrabble-engine";
import { isValidWord } from "./scrabble-dictionary";
import { BOT_NAMES, BotLevel, chooseBotMove } from "./scrabble-bot";
import { SCRABBLE_PUZZLE_RACKS, SCRABBLE_WORD_LISTS } from "./scrabble-content.seed";

// One Scrabble surface reused everywhere (Scrabble Module §5.7): vs-computer,
// friendly, Community, Match Center fixtures and tournament matches all validate
// through the same engine and feed the same standings + rating pipelines as
// every other sport. Mirrors ChessService 1:1.

const MATCH_TYPES: Record<string, { label: string; perMoveSeconds: number | null }> = {
  async: { label: "Open / Async (no clock)", perMoveSeconds: null },
  timed_blitz: { label: "Blitz (90s / move)", perMoveSeconds: 90 },
  timed_standard: { label: "Standard (5 min / move)", perMoveSeconds: 300 },
};

interface MoveLog {
  no: number;
  by: "a" | "b";
  type: "place_tiles" | "pass" | "exchange";
  word?: string;
  words?: string[];
  score: number;
}

@Injectable()
export class ScrabbleService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
    private tournaments: TournamentsService
  ) {}

  async onModuleInit() {
    await this.prisma.sport
      .upsert({ where: { key: "scrabble" }, update: {}, create: { key: "scrabble", name: "Scrabble" } })
      .catch(() => undefined);
    await this.seedPuzzles().catch(() => undefined);
    await this.seedWordLists().catch(() => undefined);
  }

  // Compute each puzzle's optimal play through the real engine, so the stored
  // best word/score always matches the live dictionary.
  private async seedPuzzles() {
    if ((await this.prisma.scrabblePuzzle.count()) > 0) return;
    for (const p of SCRABBLE_PUZZLE_RACKS) {
      const st = initialState();
      st.rackA = [...p.rack];
      st.board = new Array(225).fill("");
      const best = chooseBotMove(st, 3);
      if (!best) continue;
      const applied = applyPlacement(st, best.placements);
      if (!applied.ok) continue;
      await this.prisma.scrabblePuzzle.create({
        data: {
          board: st.board as unknown as object,
          rack: p.rack,
          bestWord: (applied.words ?? []).join(", "),
          bestScore: applied.score ?? 0,
          theme: p.theme,
          rating: p.rating,
        },
      });
    }
  }

  private async seedWordLists() {
    if ((await this.prisma.scrabbleWordList.count({ where: { academyId: null } })) > 0) return;
    for (const list of SCRABBLE_WORD_LISTS) {
      await this.prisma.scrabbleWordList.create({
        data: {
          academyId: null,
          title: list.title,
          description: list.description,
          entries: { create: list.entries.map((e) => ({ word: e.word, definition: e.definition, example: e.example })) },
        },
      });
    }
  }

  matchTypes() {
    return Object.entries(MATCH_TYPES).map(([key, v]) => ({ key, label: v.label }));
  }

  // ── Clients & opponents (§5.4) ─────────────────────────────────────────────

  private async clientOrThrow(academyId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, academyId: true, centerId: true },
    });
    if (!client || client.academyId !== academyId) throw new ForbiddenException("Player not in your academy.");
    return client;
  }

  async opponents(academyId: string, clientId: string) {
    const me = await this.clientOrThrow(academyId, clientId);
    // Respect blocks in both directions (§5.10).
    const blocks = await this.prisma.gameBlock.findMany({
      where: { OR: [{ blockerClientId: clientId }, { blockedClientId: clientId }] },
      select: { blockerClientId: true, blockedClientId: true },
    });
    const hidden = new Set(blocks.flatMap((b) => [b.blockerClientId, b.blockedClientId]));
    const all = await this.prisma.client.findMany({
      where: { academyId, id: { not: clientId } },
      select: { id: true, name: true, centerId: true, center: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    const visible = all.filter((c) => !hidden.has(c.id));
    return {
      sameCenter: visible.filter((c) => c.centerId && c.centerId === me.centerId),
      otherCenters: visible.filter((c) => !c.centerId || c.centerId !== me.centerId),
    };
  }

  // ── Challenges (§5.4) ──────────────────────────────────────────────────────

  async challenge(academyId: string, challengerClientId: string, opponentClientId: string, matchType = "async") {
    if (challengerClientId === opponentClientId) throw new BadRequestException("You can't challenge yourself.");
    const me = await this.clientOrThrow(academyId, challengerClientId);
    const them = await this.clientOrThrow(academyId, opponentClientId);
    const blocked = await this.prisma.gameBlock.findFirst({
      where: {
        OR: [
          { blockerClientId: opponentClientId, blockedClientId: challengerClientId },
          { blockerClientId: challengerClientId, blockedClientId: opponentClientId },
        ],
      },
    });
    if (blocked) throw new ForbiddenException("You can't challenge this player.");
    const mt = MATCH_TYPES[matchType] ? matchType : "async";
    const sameCenter = Boolean(me.centerId && me.centerId === them.centerId);

    if (sameCenter) {
      const game = await this.createGame({ context: "friendly", academyId, aId: me.id, bId: them.id, aName: me.name, bName: them.name, matchType: mt });
      const ch = await this.prisma.scrabbleChallenge.create({
        data: { academyId, challengerClientId, opponentClientId, sameCenter: true, status: "accepted", gameId: game.id, matchType: mt },
      });
      return { challenge: ch, game: this.publicGame(game, me.id) };
    }
    const existing = await this.prisma.scrabbleChallenge.findFirst({
      where: { challengerClientId, opponentClientId, status: "pending" },
    });
    if (existing) return { challenge: existing, game: null };
    const ch = await this.prisma.scrabbleChallenge.create({
      data: { academyId, challengerClientId, opponentClientId, sameCenter: false, status: "pending", matchType: mt },
    });
    return { challenge: ch, game: null };
  }

  async challenges(academyId: string, clientId: string) {
    await this.clientOrThrow(academyId, clientId);
    const rows = await this.prisma.scrabbleChallenge.findMany({
      where: { OR: [{ challengerClientId: clientId }, { opponentClientId: clientId }], status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const ids = [...new Set(rows.flatMap((r) => [r.challengerClientId, r.opponentClientId]))];
    const names = new Map(
      (await this.prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((c) => [c.id, c.name])
    );
    return rows.map((r) => ({
      ...r,
      challengerName: names.get(r.challengerClientId) ?? "Player",
      opponentName: names.get(r.opponentClientId) ?? "Player",
      incoming: r.opponentClientId === clientId,
    }));
  }

  async respond(academyId: string, challengeId: string, clientId: string, accept: boolean) {
    const ch = await this.prisma.scrabbleChallenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.academyId !== academyId) throw new NotFoundException("Challenge not found.");
    if (ch.opponentClientId !== clientId) throw new ForbiddenException("Only the invited player can respond.");
    if (ch.status !== "pending") throw new BadRequestException("This invitation was already answered.");
    if (!accept) return this.prisma.scrabbleChallenge.update({ where: { id: challengeId }, data: { status: "declined" } });
    const [me, them] = await Promise.all([
      this.clientOrThrow(academyId, ch.challengerClientId),
      this.clientOrThrow(academyId, ch.opponentClientId),
    ]);
    const game = await this.createGame({ context: "friendly", academyId, aId: me.id, bId: them.id, aName: me.name, bName: them.name, matchType: ch.matchType });
    await this.prisma.scrabbleChallenge.update({ where: { id: challengeId }, data: { status: "accepted", gameId: game.id } });
    return { accepted: true, game: this.publicGame(game, clientId) };
  }

  // ── Games ──────────────────────────────────────────────────────────────────

  private createGame(data: {
    context: string;
    academyId?: string;
    fixtureId?: string;
    tournamentMatchId?: string;
    aId: string;
    bId: string;
    aName: string;
    bName: string;
    matchType?: string;
    botLevel?: number;
    isRated?: boolean;
  }) {
    const mt = MATCH_TYPES[data.matchType ?? "async"] ? data.matchType! : "async";
    const perMoveSeconds = MATCH_TYPES[mt].perMoveSeconds;
    const state = initialState();
    return this.prisma.scrabbleGame.create({
      data: {
        context: data.context,
        academyId: data.academyId ?? null,
        fixtureId: data.fixtureId ?? null,
        tournamentMatchId: data.tournamentMatchId ?? null,
        botLevel: data.botLevel ?? null,
        playerAId: data.aId,
        playerBId: data.bId,
        playerAName: data.aName,
        playerBName: data.bName,
        state: state as unknown as object,
        matchType: mt,
        perMoveSeconds,
        isRated: data.isRated ?? false,
        turnStartedAt: perMoveSeconds != null ? new Date() : null,
      },
    });
  }

  private state(g: { state: unknown }): GameState {
    return g.state as GameState;
  }

  // Redact the opponent's rack — a client only ever sees their own tiles, the
  // board, scores and counts. Spectators (not a player) see neither rack.
  private publicGame(g: Awaited<ReturnType<PrismaService["scrabbleGame"]["create"]>>, viewerId?: string) {
    const s = this.state(g);
    const isA = viewerId === g.playerAId;
    const isB = viewerId === g.playerBId;
    const myTurn = g.status === "active" && ((isA && s.toMove === "a") || (isB && s.toMove === "b"));
    return {
      id: g.id,
      context: g.context,
      status: g.status,
      winner: g.winner,
      termination: g.termination,
      matchType: g.matchType,
      perMoveSeconds: g.perMoveSeconds,
      playerAId: g.playerAId,
      playerBId: g.playerBId,
      playerAName: g.playerAName,
      playerBName: g.playerBName,
      board: s.board,
      blanks: s.blanks,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
      toMove: s.toMove,
      myTurn,
      myRack: isA ? s.rackA : isB ? s.rackB : [],
      oppRackCount: (isA ? s.rackB : s.rackA).length,
      bagCount: s.bag.length,
      turnStartedAt: g.turnStartedAt,
      moves: g.moves,
    };
  }

  async myGames(academyId: string, clientId: string) {
    await this.clientOrThrow(academyId, clientId);
    const rows = await this.prisma.scrabbleGame.findMany({
      where: { OR: [{ playerAId: clientId }, { playerBId: clientId }] },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return rows.map((g) => this.publicGame(g, clientId));
  }

  async getGame(gameId: string, viewerId?: string) {
    let g = await this.prisma.scrabbleGame.findUnique({ where: { id: gameId } });
    if (!g) throw new NotFoundException("Game not found.");
    g = await this.enforceClock(g);
    return this.publicGame(g, viewerId);
  }

  // Timed play (§5.7): if the side-to-move blew their per-move clock, the turn
  // is auto-passed. Claimable from any read, like the chess flag-fall.
  private async enforceClock(g: Awaited<ReturnType<PrismaService["scrabbleGame"]["findUniqueOrThrow"]>>) {
    if (g.status !== "active" || g.perMoveSeconds == null || !g.turnStartedAt) return g;
    const elapsed = (Date.now() - g.turnStartedAt.getTime()) / 1000;
    if (elapsed <= g.perMoveSeconds) return g;
    const res = applyPass(this.state(g));
    return this.commitMove(g, res, res.state!.toMove === "a" ? "b" : "a", { type: "pass", score: 0 }, true);
  }

  // playerId is a clientId (academy games) or "bot"/tournament-user id.
  async move(
    gameId: string,
    playerId: string,
    action: { type: "place" | "pass" | "exchange"; placements?: Placement[]; tiles?: string[] }
  ) {
    const g = await this.prisma.scrabbleGame.findUnique({ where: { id: gameId } });
    if (!g) throw new NotFoundException("Game not found.");
    if (g.status !== "active") throw new BadRequestException("This game is over.");
    if (playerId !== g.playerAId && playerId !== g.playerBId) throw new ForbiddenException("You're not a player in this game.");
    const s = this.state(g);
    const myColor: "a" | "b" = playerId === g.playerAId ? "a" : "b";
    if (s.toMove !== myColor) throw new BadRequestException("It's not your turn.");

    let res;
    let log: Omit<MoveLog, "no" | "by">;
    if (action.type === "place") {
      res = applyPlacement(s, action.placements ?? []);
      if (!res.ok) throw new BadRequestException(res.error);
      log = { type: "place_tiles", word: (res.words ?? [])[0], words: res.words, score: res.score ?? 0 };
    } else if (action.type === "exchange") {
      res = applyPass(s, action.tiles ?? []);
      if (!res.ok) throw new BadRequestException(res.error);
      log = { type: "exchange", score: 0 };
    } else {
      res = applyPass(s);
      log = { type: "pass", score: 0 };
    }

    let updated = await this.commitMove(g, res, myColor, log);
    // vs-computer: the bot replies in the same request.
    if (updated.status === "active" && updated.context === "bot") {
      updated = await this.playBotReply(updated);
    }
    return this.publicGame(updated, playerId);
  }

  private async commitMove(
    g: Awaited<ReturnType<PrismaService["scrabbleGame"]["findUniqueOrThrow"]>>,
    res: ReturnType<typeof applyPlacement>,
    by: "a" | "b",
    log: Omit<MoveLog, "no" | "by">,
    fromClock = false
  ) {
    const next = res.state!;
    const moves = [...((g.moves as unknown as MoveLog[]) ?? []), { no: ((g.moves as unknown[]) ?? []).length + 1, by, ...log }];
    const finished = Boolean(res.finished);
    const winner = res.winner ?? null;
    const termination = finished
      ? next.passStreak >= 2
        ? "consecutive_passes"
        : "bag_and_racks_empty"
      : null;
    const updated = await this.prisma.scrabbleGame.update({
      where: { id: g.id },
      data: {
        state: next as unknown as object,
        moves: moves as unknown as object,
        scoreA: next.scoreA,
        scoreB: next.scoreB,
        status: finished ? "completed" : "active",
        winner,
        termination,
        turnStartedAt: finished ? null : g.perMoveSeconds != null ? new Date() : null,
      },
    });
    if (finished) await this.reportResult(updated);
    return updated;
  }

  private async playBotReply(g: Awaited<ReturnType<PrismaService["scrabbleGame"]["update"]>>) {
    const s = this.state(g);
    const botColor: "a" | "b" = g.playerBId === "bot" ? "b" : "a";
    if (s.toMove !== botColor) return g;
    const best = chooseBotMove(s, (g.botLevel ?? 2) as BotLevel);
    const res = best ? applyPlacement(s, best.placements) : applyPass(s);
    if (!res.ok) return g;
    const log: Omit<MoveLog, "no" | "by"> = best
      ? { type: "place_tiles", word: (res.words ?? [])[0], words: res.words, score: res.score ?? 0 }
      : { type: "pass", score: 0 };
    // Bot games are casual — commitMove won't rate them (no fixture/tournament).
    return this.commitMove(g, res, botColor, log);
  }

  // ── Play vs Computer (§5.1) ────────────────────────────────────────────────

  async createBotGame(academyId: string, clientId: string, level: number, matchType = "async") {
    const client = await this.clientOrThrow(academyId, clientId);
    const lvl = ([1, 2, 3].includes(level) ? level : 2) as BotLevel;
    // The human is player A and always moves first.
    return this.publicGame(
      await this.createGame({
        context: "bot",
        academyId,
        botLevel: lvl,
        aId: clientId,
        bId: "bot",
        aName: client.name,
        bName: BOT_NAMES[lvl],
        matchType,
      }),
      clientId
    );
  }

  async resign(gameId: string, playerId: string) {
    const g = await this.prisma.scrabbleGame.findUnique({ where: { id: gameId } });
    if (!g) throw new NotFoundException("Game not found.");
    if (g.status !== "active") throw new BadRequestException("This game is over.");
    if (playerId !== g.playerAId && playerId !== g.playerBId) throw new ForbiddenException("You're not a player in this game.");
    const winner = playerId === g.playerAId ? "b" : "a";
    const updated = await this.prisma.scrabbleGame.update({
      where: { id: gameId },
      data: { status: "resigned", winner, termination: "resignation", turnStartedAt: null },
    });
    await this.reportResult(updated);
    return this.publicGame(updated, playerId);
  }

  // Game over → same pipelines as every other sport (§5.7 step 6).
  private async reportResult(g: { fixtureId: string | null; tournamentMatchId: string | null; winner: string | null; scoreA: number; scoreB: number }) {
    const display = `${g.scoreA}-${g.scoreB}`;
    if (g.fixtureId) {
      const side = g.winner === "a" ? "A" : g.winner === "b" ? "B" : "draw";
      await this.scoring.completeFixtureFromEngine(g.fixtureId, side as "A" | "B" | "draw", display).catch(() => undefined);
    }
    if (g.tournamentMatchId) {
      const w = g.winner === "a" ? "white" : g.winner === "b" ? "black" : "draw";
      await this.tournaments.completeChessMatch(g.tournamentMatchId, w as "white" | "black" | "draw").catch(() => undefined);
    }
  }

  // ── Puzzles (§5.2) ─────────────────────────────────────────────────────────

  async nextPuzzle(excludeId?: string) {
    const total = await this.prisma.scrabblePuzzle.count();
    if (total === 0) throw new NotFoundException("No puzzles available.");
    const puzzles = await this.prisma.scrabblePuzzle.findMany({ where: excludeId ? { id: { not: excludeId } } : {} });
    const p = puzzles[puzzles.length ? new Date().getMinutes() % puzzles.length : 0] ?? puzzles[0];
    return { id: p.id, board: p.board, rack: p.rack, theme: p.theme, rating: p.rating, bestScore: p.bestScore };
  }

  // Validate the attempt through the engine and grade it against the optimal.
  async attemptPuzzle(id: string, placements: Placement[]) {
    const puzzle = await this.prisma.scrabblePuzzle.findUnique({ where: { id } });
    if (!puzzle) throw new NotFoundException("Puzzle not found.");
    const st = initialState();
    st.board = puzzle.board as unknown as string[];
    st.rackA = [...puzzle.rack];
    st.toMove = "a";
    const res = applyPlacement(st, placements ?? []);
    if (!res.ok) return { valid: false, error: res.error, bestWord: puzzle.bestWord, bestScore: puzzle.bestScore };
    const yourScore = res.score ?? 0;
    const solved = yourScore >= puzzle.bestScore;
    return {
      valid: true,
      solved,
      yourScore,
      yourWords: res.words,
      bestScore: puzzle.bestScore,
      bestWord: puzzle.bestWord,
      quality: puzzle.bestScore > 0 ? Math.round((yourScore / puzzle.bestScore) * 100) : 100,
    };
  }

  // ── Word Power tests (§5.3, spaced repetition) ─────────────────────────────

  async wordLists(academyId: string | null) {
    const lists = await this.prisma.scrabbleWordList.findMany({
      where: { OR: [{ academyId: null }, ...(academyId ? [{ academyId }] : [])] },
      include: { _count: { select: { entries: true } } },
      orderBy: { title: "asc" },
    });
    return lists.map((l) => ({ id: l.id, title: l.title, description: l.description, wordCount: l._count.entries }));
  }

  // Admin/Head-Coach word-list authoring (§5.3). Lists are academy-scoped;
  // the platform starter library (academyId=null) is read-only here.
  async getWordList(academyId: string, id: string) {
    const list = await this.prisma.scrabbleWordList.findUnique({ where: { id }, include: { entries: { orderBy: { createdAt: "asc" } } } });
    if (!list || (list.academyId && list.academyId !== academyId)) throw new NotFoundException("Word list not found.");
    return list;
  }

  createWordList(academyId: string, dto: { title: string; description?: string; gradeKey?: string }) {
    if (!dto.title?.trim()) throw new BadRequestException("A title is required.");
    return this.prisma.scrabbleWordList.create({
      data: { academyId, title: dto.title.trim(), description: dto.description?.trim() || null, gradeKey: dto.gradeKey || null },
    });
  }

  async addWordEntry(academyId: string, listId: string, dto: { word: string; definition: string; example?: string }) {
    const list = await this.prisma.scrabbleWordList.findUnique({ where: { id: listId } });
    if (!list || list.academyId !== academyId) throw new ForbiddenException("You can only edit your academy's lists.");
    if (!dto.word?.trim() || !dto.definition?.trim()) throw new BadRequestException("Word and definition are required.");
    return this.prisma.scrabbleWordEntry.create({
      data: { listId, word: dto.word.trim().toLowerCase(), definition: dto.definition.trim(), example: dto.example?.trim() || null },
    });
  }

  async deleteWordEntry(academyId: string, listId: string, entryId: string) {
    const list = await this.prisma.scrabbleWordList.findUnique({ where: { id: listId } });
    if (!list || list.academyId !== academyId) throw new ForbiddenException("You can only edit your academy's lists.");
    await this.prisma.scrabbleWordEntry.delete({ where: { id: entryId } }).catch(() => undefined);
    return { deleted: true };
  }

  // Enroll every word in a list into the student's review schedule (idempotent).
  async startTest(clientId: string, listId: string) {
    const entries = await this.prisma.scrabbleWordEntry.findMany({ where: { listId }, select: { id: true } });
    if (entries.length === 0) throw new NotFoundException("Word list is empty or not found.");
    for (const e of entries) {
      await this.prisma.scrabbleTestProgress
        .upsert({
          where: { clientId_wordEntryId: { clientId, wordEntryId: e.id } },
          update: {},
          create: { clientId, wordEntryId: e.id, dueAt: new Date() },
        })
        .catch(() => undefined);
    }
    return { enrolled: entries.length };
  }

  // The current due-for-review queue — a Test session is simply every word due.
  async dueTests(clientId: string) {
    const due = await this.prisma.scrabbleTestProgress.findMany({
      where: { clientId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: "asc" },
      take: 20,
    });
    const entries = await this.prisma.scrabbleWordEntry.findMany({
      where: { id: { in: due.map((d) => d.wordEntryId) } },
    });
    const byId = new Map(entries.map((e) => [e.id, e]));
    const total = await this.prisma.scrabbleTestProgress.count({ where: { clientId } });
    return {
      dueCount: due.length,
      total,
      words: due
        .map((d) => {
          const e = byId.get(d.wordEntryId);
          return e ? { wordEntryId: e.id, word: e.word, definition: e.definition, example: e.example, box: d.box } : null;
        })
        .filter(Boolean),
    };
  }

  // Leitner spaced repetition: correct pushes the word to a higher box (longer
  // interval); wrong resets it to box 0 (due again soon). Identical to Chess Tests.
  async answerTest(clientId: string, wordEntryId: string, correct: boolean) {
    const prog = await this.prisma.scrabbleTestProgress.findUnique({
      where: { clientId_wordEntryId: { clientId, wordEntryId } },
    });
    if (!prog) throw new NotFoundException("This word isn't in your review queue.");
    const box = correct ? Math.min(prog.box + 1, 6) : 0;
    // Interval per box in days: 0,1,2,4,8,16,32.
    const days = box === 0 ? 0 : Math.pow(2, box - 1);
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.scrabbleTestProgress.update({
      where: { clientId_wordEntryId: { clientId, wordEntryId } },
      data: {
        box,
        correctCount: prog.correctCount + (correct ? 1 : 0),
        wrongCount: prog.wrongCount + (correct ? 0 : 1),
        dueAt,
      },
    });
    return { box, correct, nextDueInDays: days };
  }

  // ── Blocking (§5.10) ───────────────────────────────────────────────────────

  async block(academyId: string, blockerClientId: string, blockedClientId: string) {
    await this.clientOrThrow(academyId, blockerClientId);
    await this.clientOrThrow(academyId, blockedClientId);
    return this.prisma.gameBlock
      .upsert({
        where: { blockerClientId_blockedClientId: { blockerClientId, blockedClientId } },
        update: {},
        create: { blockerClientId, blockedClientId },
      })
      .then(() => ({ blocked: true }));
  }

  // ── Community open-seek (§5.5) ─────────────────────────────────────────────

  private async isBlockedPair(x: string, y: string) {
    return Boolean(
      await this.prisma.gameBlock.findFirst({
        where: { OR: [{ blockerClientId: x, blockedClientId: y }, { blockerClientId: y, blockedClientId: x }] },
      })
    );
  }

  // Post an open seek; if a compatible one is already waiting, pair immediately.
  // Matching is by academy + match type, skipping any blocked pair (§5.10).
  async seek(academyId: string, clientId: string, matchType = "async") {
    const me = await this.clientOrThrow(academyId, clientId);
    const mt = MATCH_TYPES[matchType] ? matchType : "async";
    // Already have an open seek? Return its status instead of duplicating.
    const mine = await this.prisma.scrabbleSeek.findFirst({ where: { clientId, status: "open" } });
    if (mine) return this.seekStatus(academyId, clientId);

    const waiting = await this.prisma.scrabbleSeek.findMany({
      where: { academyId, status: "open", matchType: mt, clientId: { not: clientId } },
      orderBy: { createdAt: "asc" },
    });
    for (const w of waiting) {
      if (await this.isBlockedPair(clientId, w.clientId)) continue;
      const them = await this.prisma.client.findUnique({ where: { id: w.clientId }, select: { id: true, name: true } });
      if (!them) continue;
      // Pair them: the waiting seeker (posted first) is player A.
      const game = await this.createGame({ context: "community", academyId, aId: them.id, bId: me.id, aName: them.name, bName: me.name, matchType: mt });
      await this.prisma.scrabbleSeek.update({ where: { id: w.id }, data: { status: "matched", gameId: game.id } });
      return { matched: true, game: this.publicGame(game, clientId) };
    }
    const seek = await this.prisma.scrabbleSeek.create({ data: { academyId, clientId, matchType: mt, status: "open" } });
    return { matched: false, seek };
  }

  // Poll: has my open seek been matched by someone else joining?
  async seekStatus(academyId: string, clientId: string) {
    const seek = await this.prisma.scrabbleSeek.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } });
    if (!seek) return { matched: false, seek: null };
    if (seek.status === "matched" && seek.gameId) {
      const g = await this.prisma.scrabbleGame.findUnique({ where: { id: seek.gameId } });
      return { matched: true, game: g ? this.publicGame(g, clientId) : null };
    }
    return { matched: false, seek: seek.status === "open" ? seek : null };
  }

  async cancelSeek(clientId: string) {
    await this.prisma.scrabbleSeek.updateMany({ where: { clientId, status: "open" }, data: { status: "cancelled" } });
    return { cancelled: true };
  }

  // ── Word Rush (§5.2): a timed "find as many words as you can" drill ─────────

  wordRushNew() {
    // A sequence of fresh racks + a 180s clock. Stateless — the client keeps the
    // running score and validates each word against /word-rush/check.
    return { seconds: 180, racks: Array.from({ length: 12 }, () => randomRack()) };
  }

  // Validate a single Word Rush word: must be a real word AND formable from the
  // rack (each letter available). Points = the word's letter values.
  wordRushCheck(rack: string[], word: string) {
    const w = (word ?? "").trim().toLowerCase();
    if (w.length < 2) return { valid: false, points: 0, reason: "Too short." };
    if (!isValidWord(w)) return { valid: false, points: 0, reason: "Not in the word list." };
    const pool: Record<string, number> = {};
    for (const t of rack) pool[t.toLowerCase()] = (pool[t.toLowerCase()] ?? 0) + 1;
    for (const ch of w) {
      if ((pool[ch] ?? 0) <= 0) return { valid: false, points: 0, reason: "Uses tiles you don't have." };
      pool[ch]--;
    }
    const points = w.split("").reduce((n, ch) => n + (LETTER_VALUES[ch] ?? 0), 0);
    return { valid: true, points };
  }

  // ── Rating (§5.8) ──────────────────────────────────────────────────────────

  async rating(clientId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { clientId, sportKey: "scrabble" },
    });
    return ratings;
  }

  // ── Match Center fixture link (§5.7) ───────────────────────────────────────

  async gameForFixture(academyId: string, fixtureId: string) {
    const existing = await this.prisma.scrabbleGame.findUnique({ where: { fixtureId } });
    if (existing) {
      // Any caller from either academy can open the board; the service keeps
      // whose-rack-is-whose private through publicGame.
      return existing;
    }
    const fixture = await this.prisma.fixture.findUnique({ where: { id: fixtureId } });
    if (!fixture) throw new NotFoundException("Fixture not found.");
    if (fixture.sportKey !== "scrabble") throw new BadRequestException("Not a Scrabble fixture.");
    if (fixture.status === "completed" || fixture.status === "abandoned") throw new BadRequestException("This fixture is settled.");
    const aId = fixture.entrantA[0];
    const bId = fixture.entrantB[0];
    if (!aId || !bId) throw new BadRequestException("Both sides need a rostered player.");
    const players = await this.prisma.client.findMany({
      where: { id: { in: [aId, bId] } },
      select: { id: true, name: true, academyId: true },
    });
    if (!players.some((p) => p.academyId === academyId)) throw new ForbiddenException("Your academy is not part of this fixture.");
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Player";
    return this.createGame({
      context: "fixture",
      academyId,
      fixtureId,
      aId,
      bId,
      aName: nameOf(aId),
      bName: nameOf(bId),
      matchType: "async",
      isRated: true,
    });
  }

  // Used by the controller to attach the viewer's private rack to a fixture game.
  view(g: Awaited<ReturnType<PrismaService["scrabbleGame"]["create"]>>, viewerId?: string) {
    return this.publicGame(g, viewerId);
  }

  // End-game rack values, exposed for the post-game review (§5.1).
  tileValue(letter: string) {
    return LETTER_VALUES[letter] ?? 0;
  }
}
