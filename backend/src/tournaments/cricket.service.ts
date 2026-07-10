import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CricketDelivery, TournamentCricketConfig } from "@prisma/client";

// Cricket ball-by-ball engine (Cricket Scoring Requirements v1.0).
// Every number shown anywhere — innings totals, batting/bowling cards,
// partnerships, graphs, the result itself — is derived from the delivery log
// on demand. Nothing is stored twice, so corrections can never leave a stale
// figure behind (BRD Cricket 4.4, 4.6, 5).

const ILLEGAL = new Set(["wide", "no_ball"]);
const WICKET_NEEDS_FIELDER = new Set(["caught", "run_out", "stumped"]);

export interface CricketBallDto {
  batter: string;
  nonStriker: string;
  bowler: string;
  runsOffBat?: number;
  extraType?: "wide" | "no_ball" | "bye" | "leg_bye" | "penalty" | null;
  extraRuns?: number;
  isWicket?: boolean;
  wicketType?: string | null;
  dismissedBatter?: string | null;
  fielder?: string | null;
  shotDirection?: string | null;
}

interface BattingRow {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  dismissal: string | null;
}

interface BowlingRow {
  name: string;
  balls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

function oversText(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

@Injectable()
export class CricketService {
  constructor(private prisma: PrismaService) {}

  private async matchWithAccess(userId: string, matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: {
        event: { include: { tournament: { include: { officials: true } } } },
        cricketConfig: true,
      },
    });
    if (!match) throw new NotFoundException("Match not found.");
    if (match.event.sportKey !== "cricket") {
      throw new BadRequestException("Ball-by-ball scoring is the cricket template — this event isn't cricket.");
    }
    const t = match.event.tournament;
    const allowed = t.organizerId === userId || t.officials.some((o) => o.userId === userId);
    if (!allowed) throw new ForbiddenException("Only the organizer or an appointed official can score.");
    return match;
  }

  private async entryNames(match: { entryAId: string | null; entryBId: string | null }) {
    const ids = [match.entryAId, match.entryBId].filter(Boolean) as string[];
    const entries = await this.prisma.tournamentEntry.findMany({ where: { id: { in: ids } } });
    const nameOf = (id: string | null) => {
      const e = entries.find((x) => x.id === id);
      return e ? (e.teamName ?? (e.players as { name: string }[])[0]?.name ?? "Team") : "TBD";
    };
    const playersOf = (id: string | null) => {
      const e = entries.find((x) => x.id === id);
      return e ? ((e.players as { name: string }[]) ?? []).map((p) => p.name) : [];
    };
    return {
      teamA: nameOf(match.entryAId),
      teamB: nameOf(match.entryBId),
      rosterA: playersOf(match.entryAId),
      rosterB: playersOf(match.entryBId),
    };
  }

  // ── Match setup (BRD Cricket 4.1) ─────────────────────────────────────────

  async setup(
    userId: string,
    matchId: string,
    dto: { oversPerSide: number; battingFirst: "A" | "B"; playersA?: string[]; playersB?: string[]; dlsEnabled?: boolean }
  ) {
    const match = await this.matchWithAccess(userId, matchId);
    if (match.status === "completed") throw new BadRequestException("Match already completed.");
    if (!match.entryAId || !match.entryBId) throw new BadRequestException("Both slots must be filled first.");
    if (!Number.isInteger(dto.oversPerSide) || dto.oversPerSide < 1 || dto.oversPerSide > 90) {
      throw new BadRequestException("Overs per side must be between 1 and 90 — any count is fine (6, 8, 10, 20, 50…).");
    }
    const names = await this.entryNames(match);
    const config = await this.prisma.tournamentCricketConfig.upsert({
      where: { matchId },
      update: {
        oversPerSide: dto.oversPerSide,
        battingFirst: dto.battingFirst,
        playersA: dto.playersA?.length ? dto.playersA : names.rosterA,
        playersB: dto.playersB?.length ? dto.playersB : names.rosterB,
        dlsEnabled: dto.dlsEnabled ?? false,
      },
      create: {
        matchId,
        oversPerSide: dto.oversPerSide,
        battingFirst: dto.battingFirst,
        playersA: dto.playersA?.length ? dto.playersA : names.rosterA,
        playersB: dto.playersB?.length ? dto.playersB : names.rosterB,
        dlsEnabled: dto.dlsEnabled ?? false,
      },
    });
    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: { status: "live", officialId: userId },
    });
    return this.state(matchId, config);
  }

  // ── Ball-by-ball entry (BRD Cricket 4.2) ──────────────────────────────────

  async recordBall(userId: string, matchId: string, dto: CricketBallDto) {
    const match = await this.matchWithAccess(userId, matchId);
    const config = match.cricketConfig;
    if (!config) throw new BadRequestException("Run match setup first (overs, batting side, playing XI).");
    if (match.status === "completed") {
      throw new BadRequestException("Match is completed — use a correction (with a reason) to fix a delivery.");
    }

    const deliveries = await this.prisma.cricketDelivery.findMany({
      where: { matchId },
      orderBy: { seq: "asc" },
    });
    const derived = this.derive(config, deliveries);
    if (derived.complete) throw new BadRequestException("The match is already decided — no more deliveries.");

    const innings = derived.currentInnings;
    const runsOffBat = dto.runsOffBat ?? 0;
    const extraRuns = dto.extraRuns ?? 0;
    if (runsOffBat < 0 || runsOffBat > 6 || extraRuns < 0 || extraRuns > 7) {
      throw new BadRequestException("Runs off the bat are 0–6; extras 0–7.");
    }
    if (dto.extraType && !["wide", "no_ball", "bye", "leg_bye", "penalty"].includes(dto.extraType)) {
      throw new BadRequestException("Extra must be wide, no-ball, bye, leg-bye or penalty.");
    }
    if (dto.isWicket) {
      if (!dto.wicketType) throw new BadRequestException("Pick the dismissal type.");
      if (WICKET_NEEDS_FIELDER.has(dto.wicketType) && !dto.fielder) {
        throw new BadRequestException(`A ${dto.wicketType.replace("_", " ")} needs the fielder involved.`);
      }
      if (dto.extraType === "wide" && !["run_out", "stumped"].includes(dto.wicketType)) {
        throw new BadRequestException("Off a wide, only run out or stumped is possible.");
      }
    }
    // A bowler cannot bowl consecutive overs (BRD Cricket 4.2).
    const inningsBalls = deliveries.filter((d) => d.innings === innings);
    const legalSoFar = inningsBalls.filter((d) => !ILLEGAL.has(d.extraType ?? "")).length;
    if (legalSoFar % 6 === 0 && legalSoFar > 0) {
      const prevOverBowler = inningsBalls.filter((d) => !ILLEGAL.has(d.extraType ?? "")).at(-1)?.bowler;
      if (prevOverBowler && dto.bowler === prevOverBowler) {
        throw new BadRequestException(`${dto.bowler} bowled the last over — pick a different bowler.`);
      }
    }

    const isLegal = !ILLEGAL.has(dto.extraType ?? "");
    const created = await this.prisma.cricketDelivery.create({
      data: {
        matchId,
        seq: deliveries.length + 1,
        innings,
        overNo: Math.floor(legalSoFar / 6),
        ballInOver: isLegal ? (legalSoFar % 6) + 1 : 0,
        batter: dto.batter,
        nonStriker: dto.nonStriker,
        bowler: dto.bowler,
        runsOffBat,
        extraType: dto.extraType ?? null,
        extraRuns,
        isWicket: dto.isWicket ?? false,
        wicketType: dto.isWicket ? dto.wicketType : null,
        dismissedBatter: dto.isWicket ? (dto.dismissedBatter ?? dto.batter) : null,
        fielder: dto.fielder ?? null,
        shotDirection: dto.shotDirection ?? null,
      },
    });
    return this.afterChange(matchId, config, [...deliveries, created]);
  }

  // Undo the last delivery (BRD Cricket 4.6, per-ball).
  async undo(userId: string, matchId: string) {
    const match = await this.matchWithAccess(userId, matchId);
    if (!match.cricketConfig) throw new BadRequestException("No cricket session on this match.");
    const last = await this.prisma.cricketDelivery.findFirst({ where: { matchId }, orderBy: { seq: "desc" } });
    if (!last) throw new BadRequestException("Nothing to undo.");
    await this.prisma.cricketDelivery.delete({ where: { id: last.id } });
    // Undo can reopen a just-completed match — recompute handles it.
    if (match.status === "completed") {
      await this.prisma.tournamentMatch.update({ where: { id: matchId }, data: { status: "live", winnerEntryId: null } });
    }
    const deliveries = await this.prisma.cricketDelivery.findMany({ where: { matchId }, orderBy: { seq: "asc" } });
    return this.afterChange(matchId, match.cricketConfig, deliveries);
  }

  // Post-confirmation correction with a mandatory reason; the audit row keeps
  // who/when/what/why and every dependent number recomputes from the log
  // (BRD Cricket 4.6) — including standings if the match was already final.
  async correct(userId: string, matchId: string, deliveryId: string, changes: Partial<CricketBallDto>, reason: string) {
    const match = await this.matchWithAccess(userId, matchId);
    if (!match.cricketConfig) throw new BadRequestException("No cricket session on this match.");
    if (!reason?.trim()) throw new BadRequestException("A correction needs a reason — it goes in the audit log.");
    const delivery = await this.prisma.cricketDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.matchId !== matchId) throw new NotFoundException("Delivery not found.");

    const previous = { ...delivery } as unknown as Record<string, unknown>;
    const updated = await this.prisma.cricketDelivery.update({
      where: { id: deliveryId },
      data: {
        runsOffBat: changes.runsOffBat ?? delivery.runsOffBat,
        extraType: changes.extraType !== undefined ? changes.extraType : delivery.extraType,
        extraRuns: changes.extraRuns ?? delivery.extraRuns,
        isWicket: changes.isWicket ?? delivery.isWicket,
        wicketType: changes.wicketType !== undefined ? changes.wicketType : delivery.wicketType,
        dismissedBatter: changes.dismissedBatter !== undefined ? changes.dismissedBatter : delivery.dismissedBatter,
        fielder: changes.fielder !== undefined ? changes.fielder : delivery.fielder,
        batter: changes.batter ?? delivery.batter,
        bowler: changes.bowler ?? delivery.bowler,
        shotDirection: changes.shotDirection !== undefined ? changes.shotDirection : delivery.shotDirection,
      },
    });
    await this.prisma.cricketCorrection.create({
      data: {
        deliveryId,
        correctedBy: userId,
        reason: reason.trim(),
        previousPayload: previous as object,
        newPayload: updated as unknown as object,
      },
    });
    const deliveries = await this.prisma.cricketDelivery.findMany({ where: { matchId }, orderBy: { seq: "asc" } });
    return this.afterChange(matchId, match.cricketConfig, deliveries);
  }

  async getState(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { cricketConfig: true, event: { select: { name: true, sportKey: true } } },
    });
    if (!match) throw new NotFoundException("Match not found.");
    const names = await this.entryNames(match);
    const base = {
      matchId,
      eventName: match.event.name,
      round: match.round,
      matchNo: match.matchNo,
      teams: { A: names.teamA, B: names.teamB },
      rosters: { A: names.rosterA, B: names.rosterB },
      status: match.status,
    };
    if (!match.cricketConfig) return { ...base, configured: false };
    return { ...base, ...(await this.state(matchId, match.cricketConfig)) };
  }

  async corrections(matchId: string) {
    const deliveries = await this.prisma.cricketDelivery.findMany({ where: { matchId }, select: { id: true } });
    return this.prisma.cricketCorrection.findMany({
      where: { deliveryId: { in: deliveries.map((d) => d.id) } },
      orderBy: { correctedAt: "desc" },
    });
  }

  // ── State derivation — the one source of truth (BRD Cricket 4.3–4.5) ─────

  private async state(matchId: string, config: TournamentCricketConfig) {
    const deliveries = await this.prisma.cricketDelivery.findMany({ where: { matchId }, orderBy: { seq: "asc" } });
    const match = await this.prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
    const names = await this.entryNames(match);
    return { configured: true, config, ...this.derive(config, deliveries, names) };
  }

  private derive(
    config: TournamentCricketConfig,
    deliveries: CricketDelivery[],
    names?: { teamA: string; teamB: string; rosterA: string[]; rosterB: string[] }
  ) {
    const battingTeamOf = (innings: number) =>
      innings === 1 ? config.battingFirst : config.battingFirst === "A" ? "B" : "A";
    const teamName = (side: string) => (names ? (side === "A" ? names.teamA : names.teamB) : side);
    const xiOf = (side: string) => (side === "A" ? config.playersA : config.playersB);

    const inningsData = [1, 2].map((inn) => {
      const balls = deliveries.filter((d) => d.innings === inn);
      const runs = balls.reduce((s, d) => s + d.runsOffBat + d.extraRuns, 0);
      const wickets = balls.filter((d) => d.isWicket).length;
      const legal = balls.filter((d) => !ILLEGAL.has(d.extraType ?? "")).length;
      const side = battingTeamOf(inn);
      const maxWickets = Math.max(1, Math.min(10, xiOf(side).length - 1 || 10));
      const allOut = wickets >= maxWickets;
      const oversDone = legal >= config.oversPerSide * 6;
      return { inn, side, balls, runs, wickets, legal, maxWickets, allOut, oversDone };
    });

    const [i1, i2] = inningsData;
    const target = i1.allOut || i1.oversDone || i2.balls.length > 0 ? i1.runs + 1 : null;
    const chased = target != null && i2.runs >= target;
    const i1Complete = i1.allOut || i1.oversDone;
    const i2Complete = chased || i2.allOut || i2.oversDone;
    const currentInnings = !i1Complete ? 1 : 2;
    const complete = i1Complete && i2Complete && (i2.balls.length > 0 || chased);

    let resultText: string | null = null;
    let winnerSide: "A" | "B" | null = null;
    if (complete) {
      if (chased) {
        winnerSide = i2.side as "A" | "B";
        resultText = `${teamName(i2.side)} won by ${i2.maxWickets - i2.wickets} wicket${i2.maxWickets - i2.wickets === 1 ? "" : "s"}`;
      } else if (i2.runs < (target ?? 0) - 1) {
        winnerSide = i1.side as "A" | "B";
        resultText = `${teamName(i1.side)} won by ${(target ?? 1) - 1 - i2.runs} run${(target ?? 1) - 1 - i2.runs === 1 ? "" : "s"}`;
      } else {
        resultText = "Match tied";
      }
    }

    // Batting/bowling/fielding/partnerships — all from the log (BRD 4.4).
    const battingCard = (inn: (typeof inningsData)[number]): BattingRow[] => {
      const rows = new Map<string, BattingRow>();
      for (const d of inn.balls) {
        if (!rows.has(d.batter)) {
          rows.set(d.batter, { name: d.batter, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, out: false, dismissal: null });
        }
        const r = rows.get(d.batter)!;
        r.runs += d.runsOffBat;
        // Wides don't count as a ball faced; no-balls do.
        if (d.extraType !== "wide") r.balls += 1;
        if (d.runsOffBat === 4) r.fours += 1;
        if (d.runsOffBat === 6) r.sixes += 1;
        if (d.isWicket && d.dismissedBatter) {
          const victim =
            rows.get(d.dismissedBatter) ??
            rows.set(d.dismissedBatter, { name: d.dismissedBatter, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, out: false, dismissal: null }).get(d.dismissedBatter)!;
          victim.out = true;
          victim.dismissal =
            d.wicketType === "caught"
              ? `c ${d.fielder} b ${d.bowler}`
              : d.wicketType === "run_out"
                ? `run out (${d.fielder})`
                : d.wicketType === "stumped"
                  ? `st ${d.fielder} b ${d.bowler}`
                  : d.wicketType === "retired"
                    ? "retired"
                    : `${(d.wicketType ?? "out").replace("_", " ")} b ${d.bowler}`;
        }
      }
      return [...rows.values()].map((r) => ({ ...r, strikeRate: r.balls ? Math.round((r.runs / r.balls) * 1000) / 10 : 0 }));
    };

    const bowlingCard = (inn: (typeof inningsData)[number]): BowlingRow[] => {
      const rows = new Map<string, BowlingRow & { currentOverRuns: number; currentOverBalls: number }>();
      for (const d of inn.balls) {
        if (!rows.has(d.bowler)) {
          rows.set(d.bowler, { name: d.bowler, balls: 0, overs: "0.0", maidens: 0, runs: 0, wickets: 0, economy: 0, wides: 0, noBalls: 0, currentOverRuns: 0, currentOverBalls: 0 });
        }
        const r = rows.get(d.bowler)!;
        // Byes/leg-byes are not charged to the bowler; wides/no-balls are.
        const charged = d.runsOffBat + (["wide", "no_ball", "penalty"].includes(d.extraType ?? "") ? d.extraRuns : 0);
        r.runs += charged;
        r.currentOverRuns += charged;
        if (d.extraType === "wide") r.wides += 1;
        if (d.extraType === "no_ball") r.noBalls += 1;
        if (!ILLEGAL.has(d.extraType ?? "")) {
          r.balls += 1;
          r.currentOverBalls += 1;
          if (r.currentOverBalls === 6) {
            if (r.currentOverRuns === 0) r.maidens += 1;
            r.currentOverRuns = 0;
            r.currentOverBalls = 0;
          }
        }
        if (d.isWicket && d.wicketType && !["run_out", "retired"].includes(d.wicketType)) r.wickets += 1;
      }
      return [...rows.values()].map(({ currentOverRuns: _r, currentOverBalls: _b, ...r }) => ({
        ...r,
        overs: oversText(r.balls),
        economy: r.balls ? Math.round((r.runs / (r.balls / 6)) * 100) / 100 : 0,
      }));
    };

    const partnerships = (inn: (typeof inningsData)[number]) => {
      const list: { batters: string[]; runs: number; balls: number }[] = [];
      let current: { batters: Set<string>; runs: number; balls: number } | null = null;
      for (const d of inn.balls) {
        if (!current) current = { batters: new Set(), runs: 0, balls: 0 };
        current.batters.add(d.batter);
        current.batters.add(d.nonStriker);
        current.runs += d.runsOffBat + d.extraRuns;
        if (!ILLEGAL.has(d.extraType ?? "")) current.balls += 1;
        if (d.isWicket) {
          list.push({ batters: [...current.batters], runs: current.runs, balls: current.balls });
          current = null;
        }
      }
      if (current && (current.runs > 0 || current.balls > 0)) {
        list.push({ batters: [...current.batters], runs: current.runs, balls: current.balls });
      }
      return list;
    };

    const fallOfWickets = (inn: (typeof inningsData)[number]) => {
      let runs = 0;
      let legal = 0;
      let n = 0;
      const fow: { wicket: number; score: number; over: string; batter: string }[] = [];
      for (const d of inn.balls) {
        runs += d.runsOffBat + d.extraRuns;
        if (!ILLEGAL.has(d.extraType ?? "")) legal += 1;
        if (d.isWicket) {
          n += 1;
          fow.push({ wicket: n, score: runs, over: oversText(legal), batter: d.dismissedBatter ?? d.batter });
        }
      }
      return fow;
    };

    const manhattan = (inn: (typeof inningsData)[number]) => {
      const overs: { over: number; runs: number; wickets: number }[] = [];
      for (const d of inn.balls) {
        while (overs.length <= d.overNo) overs.push({ over: overs.length + 1, runs: 0, wickets: 0 });
        overs[d.overNo].runs += d.runsOffBat + d.extraRuns;
        if (d.isWicket) overs[d.overNo].wickets += 1;
      }
      return overs;
    };

    const worm = (inn: (typeof inningsData)[number]) => {
      let total = 0;
      return inn.balls
        .filter((d) => !ILLEGAL.has(d.extraType ?? "") || d.extraRuns > 0)
        .map((d) => {
          total += d.runsOffBat + d.extraRuns;
          return total;
        });
    };

    const wagon = (inn: (typeof inningsData)[number]) => {
      const dirs: Record<string, number> = {};
      for (const d of inn.balls) {
        if (d.shotDirection && d.runsOffBat >= 4) dirs[d.shotDirection] = (dirs[d.shotDirection] ?? 0) + d.runsOffBat;
      }
      return dirs;
    };

    const live = inningsData[currentInnings - 1];
    const crr = live.legal ? Math.round((live.runs / (live.legal / 6)) * 100) / 100 : 0;
    const ballsLeft = config.oversPerSide * 6 - i2.legal;
    const rrr =
      currentInnings === 2 && target != null && ballsLeft > 0
        ? Math.round(((target - i2.runs) / (ballsLeft / 6)) * 100) / 100
        : null;

    // Who's up next: the batting XI minus everyone already out.
    const outNames = new Set(live.balls.filter((d) => d.isWicket).map((d) => d.dismissedBatter ?? d.batter));
    const lastBall = live.balls.at(-1);
    const availableBatters = xiOf(live.side).filter((p) => !outNames.has(p));

    return {
      currentInnings,
      complete,
      resultText,
      winnerSide,
      target,
      crr,
      rrr,
      ballsLeft: currentInnings === 2 ? ballsLeft : null,
      innings: inningsData.map((inn) => ({
        innings: inn.inn,
        battingSide: inn.side,
        battingTeam: teamName(inn.side),
        runs: inn.runs,
        wickets: inn.wickets,
        overs: oversText(inn.legal),
        summary: `${inn.runs}/${inn.wickets} (${oversText(inn.legal)} ov)`,
        battingCard: battingCard(inn),
        bowlingCard: bowlingCard(inn),
        partnerships: partnerships(inn),
        fallOfWickets: fallOfWickets(inn),
        manhattan: manhattan(inn),
        worm: worm(inn),
        wagon: wagon(inn),
      })),
      prompts: {
        needNewBatter: Boolean(lastBall?.isWicket) && !complete,
        overJustCompleted: live.legal > 0 && live.legal % 6 === 0 && !complete,
        lastBowler: live.balls.filter((d) => !ILLEGAL.has(d.extraType ?? "")).at(-1)?.bowler ?? null,
        availableBatters,
        striker: lastBall
          ? this.nextStriker(lastBall, live.legal)
          : { striker: xiOf(live.side)[0] ?? "", nonStriker: xiOf(live.side)[1] ?? "" },
      },
      recent: deliveries.slice(-12).reverse(),
    };
  }

  // Automatic strike rotation: odd runs swap; end of over swaps again
  // (BRD Cricket 4.2) — the client may override manually.
  private nextStriker(last: CricketDelivery, legalSoFar: number) {
    const totalRan = last.runsOffBat + (["bye", "leg_bye"].includes(last.extraType ?? "") ? last.extraRuns : 0);
    let striker = last.batter;
    let nonStriker = last.nonStriker;
    if (totalRan % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    if (legalSoFar > 0 && legalSoFar % 6 === 0) [striker, nonStriker] = [nonStriker, striker];
    return { striker, nonStriker };
  }

  // After any change: refresh the match row (live summary or final result)
  // so standings/public pages always reflect the log (BRD 4.6 cascade).
  private async afterChange(matchId: string, config: TournamentCricketConfig, deliveries: CricketDelivery[]) {
    const match = await this.prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
    const names = await this.entryNames(match);
    const derived = this.derive(config, deliveries, names);
    const [x1, x2] = derived.innings;
    const bySide = (side: string) => (x1.battingSide === side ? x1 : x2);
    const display = derived.complete
      ? `${x1.summary} vs ${x2.summary} — ${derived.resultText}`
      : `${bySide(config.battingFirst).summary}${derived.target ? ` · target ${derived.target}` : ""}`;

    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: derived.complete ? "completed" : "live",
        scoreA: bySide("A").runs,
        scoreB: bySide("B").runs,
        scoreDisplay: display,
        winnerEntryId: derived.complete
          ? derived.winnerSide === "A"
            ? match.entryAId
            : derived.winnerSide === "B"
              ? match.entryBId
              : null
          : null,
      },
    });
    // Knockout: propagate the winner into the next round exactly like other sports.
    if (derived.complete && derived.winnerSide && match.nextMatchId) {
      const winnerId = derived.winnerSide === "A" ? match.entryAId : match.entryBId;
      if (winnerId) {
        await this.prisma.tournamentMatch.update({
          where: { id: match.nextMatchId },
          data: match.slotInNext === "A" ? { entryAId: winnerId } : { entryBId: winnerId },
        });
      }
    }
    return { configured: true, config, ...derived };
  }

  // ── Net Run Rate for cricket league standings (BRD Cricket 4.7) ───────────
  // Overs faced count as the FULL quota when a side is bowled out — the
  // standard NRR convention.
  async nrrByEntry(eventId: string): Promise<Map<string, { for: [number, number]; against: [number, number] }>> {
    const matches = await this.prisma.tournamentMatch.findMany({
      where: { eventId, status: "completed" },
      include: { cricketConfig: true, deliveries: true },
    });
    const acc = new Map<string, { for: [number, number]; against: [number, number] }>();
    const add = (id: string, kind: "for" | "against", runs: number, balls: number) => {
      if (!acc.has(id)) acc.set(id, { for: [0, 0], against: [0, 0] });
      const row = acc.get(id)!;
      row[kind] = [row[kind][0] + runs, row[kind][1] + balls];
    };
    for (const m of matches) {
      if (!m.cricketConfig || !m.entryAId || !m.entryBId || m.deliveries.length === 0) continue;
      const cfg = m.cricketConfig;
      for (const inn of [1, 2]) {
        const balls = m.deliveries.filter((d) => d.innings === inn);
        if (!balls.length) continue;
        const side = inn === 1 ? cfg.battingFirst : cfg.battingFirst === "A" ? "B" : "A";
        const battingEntry = side === "A" ? m.entryAId : m.entryBId;
        const bowlingEntry = side === "A" ? m.entryBId : m.entryAId;
        const runs = balls.reduce((s, d) => s + d.runsOffBat + d.extraRuns, 0);
        const legal = balls.filter((d) => !ILLEGAL.has(d.extraType ?? "")).length;
        const xi = side === "A" ? cfg.playersA : cfg.playersB;
        const allOut = balls.filter((d) => d.isWicket).length >= Math.max(1, Math.min(10, xi.length - 1 || 10));
        const ballsForNrr = allOut ? cfg.oversPerSide * 6 : legal;
        add(battingEntry, "for", runs, ballsForNrr);
        add(bowlingEntry, "against", runs, ballsForNrr);
      }
    }
    return acc;
  }
}
