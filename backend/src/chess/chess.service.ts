import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ScoringService } from "../scoring/scoring.service";
import { TournamentsService } from "../tournaments/tournaments.service";
import { applyMove, legalMovesFrom, START_FEN } from "./chess-engine";

// One chess surface reused everywhere (Chess Module BRD 5.7): friendly
// games between students, Match Center fixtures and tournament matches all
// validate through the same engine and report back into the same standings
// and rating pipelines as every other sport.
@Injectable()
export class ChessService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
    private tournaments: TournamentsService
  ) {}

  // Chess becomes an ordinary sport_key so it shows up in every existing
  // sport dropdown (host form, tournament wizard, skill levels, ratings).
  async onModuleInit() {
    await this.prisma.sport
      .upsert({ where: { key: "chess" }, update: {}, create: { key: "chess", name: "Chess" } })
      .catch(() => undefined);
  }

  // ── Opponents & challenges (BRD 5.4: same-center direct, cross-center invite) ──

  private async clientOrThrow(academyId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, academyId: true, centerId: true },
    });
    if (!client || client.academyId !== academyId) throw new ForbiddenException("Player not in your academy.");
    return client;
  }

  // Students grouped by center relative to the asking player: same-center
  // students can be played directly; other centers need an invitation.
  async opponents(academyId: string, clientId: string) {
    const me = await this.clientOrThrow(academyId, clientId);
    const all = await this.prisma.client.findMany({
      where: { academyId, id: { not: clientId } },
      select: { id: true, name: true, centerId: true, center: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return {
      sameCenter: all.filter((c) => c.centerId && c.centerId === me.centerId),
      otherCenters: all.filter((c) => !c.centerId || c.centerId !== me.centerId),
    };
  }

  async challenge(academyId: string, challengerClientId: string, opponentClientId: string) {
    if (challengerClientId === opponentClientId) throw new BadRequestException("You can't challenge yourself.");
    const me = await this.clientOrThrow(academyId, challengerClientId);
    const them = await this.clientOrThrow(academyId, opponentClientId);
    const sameCenter = Boolean(me.centerId && me.centerId === them.centerId);

    // Same center → play immediately. Other center → pending invitation.
    if (sameCenter) {
      const game = await this.createGame({
        context: "friendly",
        academyId,
        whiteId: me.id,
        blackId: them.id,
        whiteName: me.name,
        blackName: them.name,
      });
      const ch = await this.prisma.chessChallenge.create({
        data: { academyId, challengerClientId, opponentClientId, sameCenter: true, status: "accepted", gameId: game.id },
      });
      return { challenge: ch, game };
    }
    const existing = await this.prisma.chessChallenge.findFirst({
      where: { challengerClientId, opponentClientId, status: "pending" },
    });
    if (existing) return { challenge: existing, game: null };
    const ch = await this.prisma.chessChallenge.create({
      data: { academyId, challengerClientId, opponentClientId, sameCenter: false, status: "pending" },
    });
    return { challenge: ch, game: null };
  }

  async challenges(academyId: string, clientId: string) {
    await this.clientOrThrow(academyId, clientId);
    const rows = await this.prisma.chessChallenge.findMany({
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
    const ch = await this.prisma.chessChallenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.academyId !== academyId) throw new NotFoundException("Challenge not found.");
    if (ch.opponentClientId !== clientId) throw new ForbiddenException("Only the invited player can respond.");
    if (ch.status !== "pending") throw new BadRequestException("This invitation was already answered.");
    if (!accept) {
      return this.prisma.chessChallenge.update({ where: { id: challengeId }, data: { status: "declined" } });
    }
    const [me, them] = await Promise.all([
      this.clientOrThrow(academyId, ch.challengerClientId),
      this.clientOrThrow(academyId, ch.opponentClientId),
    ]);
    // Challenger takes white — they made the first move socially.
    const game = await this.createGame({
      context: "friendly",
      academyId,
      whiteId: me.id,
      blackId: them.id,
      whiteName: me.name,
      blackName: them.name,
    });
    await this.prisma.chessChallenge.update({ where: { id: challengeId }, data: { status: "accepted", gameId: game.id } });
    return { accepted: true, game };
  }

  // ── Games ──────────────────────────────────────────────────────────────────

  private createGame(data: {
    context: string;
    academyId?: string;
    fixtureId?: string;
    tournamentMatchId?: string;
    whiteId: string;
    blackId: string;
    whiteName: string;
    blackName: string;
  }) {
    return this.prisma.chessGame.create({ data });
  }

  async myGames(academyId: string, clientId: string) {
    await this.clientOrThrow(academyId, clientId);
    return this.prisma.chessGame.findMany({
      where: { OR: [{ whiteId: clientId }, { blackId: clientId }] },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  }

  async game(gameId: string) {
    const g = await this.prisma.chessGame.findUnique({ where: { id: gameId } });
    if (!g) throw new NotFoundException("Game not found.");
    return g;
  }

  legalMoves(fen: string, from: string) {
    return legalMovesFrom(fen, from);
  }

  // playerId is a clientId (academy games) or tournament-user id.
  async move(gameId: string, playerId: string, from: string, to: string, promotion?: string) {
    const g = await this.game(gameId);
    if (g.status !== "active") throw new BadRequestException("This game is over.");
    const turnPlayer = g.fen.split(/\s+/)[1] === "w" ? g.whiteId : g.blackId;
    if (playerId !== g.whiteId && playerId !== g.blackId) throw new ForbiddenException("You're not a player in this game.");
    if (playerId !== turnPlayer) throw new BadRequestException("It's not your turn.");

    const result = applyMove(g.fen, from, to, promotion);
    if (!result.ok) throw new BadRequestException(result.error);

    const moves = [...((g.moves as object[]) ?? []), { from, to, promotion: promotion ?? undefined, fen: result.fen }];
    const finished = result.status !== "active";
    const updated = await this.prisma.chessGame.update({
      where: { id: gameId },
      data: {
        fen: result.fen!,
        moves: moves as object[],
        status: finished ? result.status! : "active",
        winner: finished ? result.winner ?? null : null,
      },
    });
    if (finished) await this.reportResult(updated);
    return { ...updated, check: result.check ?? false };
  }

  async resign(gameId: string, playerId: string) {
    const g = await this.game(gameId);
    if (g.status !== "active") throw new BadRequestException("This game is over.");
    if (playerId !== g.whiteId && playerId !== g.blackId) throw new ForbiddenException("You're not a player in this game.");
    const winner = playerId === g.whiteId ? "black" : "white";
    const updated = await this.prisma.chessGame.update({
      where: { id: gameId },
      data: { status: "resigned", winner },
    });
    await this.reportResult(updated);
    return updated;
  }

  // Game over → the result flows into the SAME pipelines as every other
  // sport: fixture standings + ratings for Match Center, bracket/league
  // progression for tournaments (BRD 5.7 step 6).
  private async reportResult(g: { id: string; fixtureId: string | null; tournamentMatchId: string | null; winner: string | null }) {
    const display = g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½";
    if (g.fixtureId) {
      const winnerSide = g.winner === "white" ? "A" : g.winner === "black" ? "B" : "draw";
      await this.scoring
        .completeFixtureFromEngine(g.fixtureId, winnerSide as "A" | "B" | "draw", display)
        .catch(() => undefined);
    }
    if (g.tournamentMatchId) {
      await this.tournaments.completeChessMatch(g.tournamentMatchId, g.winner as "white" | "black" | "draw").catch(() => undefined);
    }
  }

  // ── Match Center fixture link ──────────────────────────────────────────────

  // Find-or-create the online game for a chess fixture: entrant A's first
  // player takes white. Any member of either academy can open the board;
  // only the two players can move.
  async gameForFixture(academyId: string, fixtureId: string) {
    const existing = await this.prisma.chessGame.findUnique({ where: { fixtureId } });
    if (existing) return existing;
    const fixture = await this.prisma.fixture.findUnique({ where: { id: fixtureId } });
    if (!fixture) throw new NotFoundException("Fixture not found.");
    if (fixture.sportKey !== "chess") throw new BadRequestException("Not a chess fixture.");
    if (fixture.status === "completed" || fixture.status === "abandoned") {
      throw new BadRequestException("This fixture is settled.");
    }
    const whiteId = fixture.entrantA[0];
    const blackId = fixture.entrantB[0];
    if (!whiteId || !blackId) throw new BadRequestException("Both sides need a rostered player.");
    const players = await this.prisma.client.findMany({
      where: { id: { in: [whiteId, blackId] } },
      select: { id: true, name: true, academyId: true },
    });
    if (!players.some((p) => p.academyId === academyId)) {
      throw new ForbiddenException("Your academy is not part of this fixture.");
    }
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Player";
    return this.createGame({
      context: "fixture",
      academyId,
      fixtureId,
      whiteId,
      blackId,
      whiteName: nameOf(whiteId),
      blackName: nameOf(blackId),
    });
  }

  // ── Tournament match link ──────────────────────────────────────────────────

  // Registrant-vs-registrant online play for chess tournament matches.
  async gameForTournamentMatch(userId: string, matchId: string) {
    const existing = await this.prisma.chessGame.findUnique({ where: { tournamentMatchId: matchId } });
    if (existing) return existing;
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { event: { include: { tournament: true } } },
    });
    if (!match) throw new NotFoundException("Match not found.");
    if (match.event.sportKey !== "chess") throw new BadRequestException("Not a chess match.");
    if (match.status === "completed") throw new BadRequestException("This match is settled.");
    if (!match.entryAId || !match.entryBId) throw new BadRequestException("Both slots must be filled first.");
    const entries = await this.prisma.tournamentEntry.findMany({
      where: { id: { in: [match.entryAId, match.entryBId] } },
    });
    const a = entries.find((e) => e.id === match.entryAId)!;
    const b = entries.find((e) => e.id === match.entryBId)!;
    const isOrganizer = match.event.tournament.organizerId === userId;
    const isPlayer = a.registrantId === userId || b.registrantId === userId;
    if (!isOrganizer && !isPlayer) throw new ForbiddenException("Only the two players or the organizer open this board.");
    const nameOf = (e: typeof a) => e.teamName ?? (e.players as { name: string }[])[0]?.name ?? "Player";
    // whiteId/blackId are the registrant user ids (they move the pieces);
    // quick-entry players without an account can be moved by the organizer.
    return this.createGame({
      context: "tournament",
      tournamentMatchId: matchId,
      whiteId: a.registrantId ?? match.event.tournament.organizerId,
      blackId: b.registrantId ?? match.event.tournament.organizerId,
      whiteName: nameOf(a),
      blackName: nameOf(b),
    });
  }
}
