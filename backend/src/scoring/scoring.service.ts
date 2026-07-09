import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import type { FixtureStatus, MatchType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RatingService } from "../rating/rating.service";
import { SCORING_TEMPLATE_SEEDS } from "./scoring-templates.seed";
import type { CreateFixtureDto } from "./dto/create-fixture.dto";
import type { RecordScoreEventDto } from "./dto/record-score-event.dto";
import type { CompleteSessionDto } from "./dto/complete-session.dto";
import type { SetPlayerStatsDto } from "./dto/set-player-stats.dto";

interface ResultConfirmations {
  [academyId: string]: { confirmedBy: string; confirmedAt: string };
}

// Who entered a result — drives the approval rules (referee = final).
export interface ResultEnteredBy {
  userId: string;
  role: string;
  academyId: string;
}

@Injectable()
export class ScoringService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private ratingService: RatingService
  ) {}

  // Idempotent — safe to run on every boot. Satisfies BRD 12.6's "adding a
  // sport must be possible via a config screen or seed data, no app change".
  async onModuleInit() {
    for (const t of SCORING_TEMPLATE_SEEDS) {
      await this.prisma.scoringTemplate.upsert({
        where: { sportKey_formatType: { sportKey: t.sportKey, formatType: t.formatType } },
        update: {},
        create: {
          sportKey: t.sportKey,
          formatType: t.formatType,
          periodStructure: t.periodStructure as object,
          scoreFields: t.scoreFields as object,
          winCondition: t.winCondition as object,
          playerStatFields: t.playerStatFields as object,
          displayFormat: t.displayFormat,
        },
      });
    }
  }

  listTemplates() {
    return this.prisma.scoringTemplate.findMany({ include: { sport: true } });
  }

  async getTemplate(sportKey: string, formatType: "individual" | "pair" | "team") {
    const template = await this.prisma.scoringTemplate.findUnique({
      where: { sportKey_formatType: { sportKey, formatType } },
    });
    if (!template) throw new NotFoundException("No scoring template for this sport/format yet.");
    return template;
  }

  // BRD 12.6 config-driven extensibility: upsert lets an Admin add or tweak a
  // sport template without a code change.
  upsertTemplate(sportKey: string, formatType: "individual" | "pair" | "team", body: Record<string, unknown>) {
    const { periodStructure, scoreFields, winCondition, playerStatFields, displayFormat } = body;
    return this.prisma.scoringTemplate.upsert({
      where: { sportKey_formatType: { sportKey, formatType } },
      create: {
        sportKey,
        formatType,
        periodStructure: periodStructure as object,
        scoreFields: scoreFields as object,
        winCondition: winCondition as object,
        playerStatFields: playerStatFields as object,
        displayFormat: displayFormat as string,
      },
      update: {
        periodStructure: periodStructure as object,
        scoreFields: scoreFields as object,
        winCondition: winCondition as object,
        playerStatFields: playerStatFields as object,
        displayFormat: displayFormat as string,
      },
    });
  }

  async findFixtures(academyId: string, filters: { eventId?: string; status?: FixtureStatus; matchType?: MatchType }) {
    return this.prisma.fixture.findMany({
      where: {
        ...filters,
        OR: [
          { event: { hostAcademyId: academyId } },
          { event: { invitations: { some: { invitedAcademyId: academyId, status: "accepted" } } } },
          // LBL: paid sport registration makes the school an event member.
          { event: { lblRegistrations: { some: { academyId, status: "paid" } } } },
          { eventId: null, matchType: { in: ["practice", "internal_ladder"] } },
        ],
      },
      include: { sport: true, event: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
  }

  private async assertFixtureAccess(academyId: string, fixtureId: string) {
    const fixture = await this.prisma.fixture.findUnique({ where: { id: fixtureId } });
    if (!fixture) throw new NotFoundException("Fixture not found.");
    if (fixture.eventId) {
      const event = await this.prisma.interschoolEvent.findUnique({
        where: { id: fixture.eventId },
        include: { invitations: true, lblRegistrations: true },
      });
      const isMember =
        event?.hostAcademyId === academyId ||
        event?.invitations.some((i) => i.invitedAcademyId === academyId && i.status === "accepted") ||
        // LBL: a paid sport registration makes the school an event member.
        event?.lblRegistrations.some((r) => r.academyId === academyId && r.status === "paid");
      if (!isMember) throw new ForbiddenException("Your academy is not part of this fixture's event.");
    } else {
      const allClientIds = [...fixture.entrantA, ...fixture.entrantB];
      const clients = await this.prisma.client.findMany({ where: { id: { in: allClientIds } } });
      if (clients.some((c) => c.academyId !== academyId)) {
        throw new ForbiddenException("This fixture involves clients outside your academy.");
      }
    }
    return fixture;
  }

  async findFixtureOrThrow(academyId: string, fixtureId: string) {
    const fixture = await this.assertFixtureAccess(academyId, fixtureId);
    const full = await this.prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
      include: {
        sport: true,
        scoringSessions: { include: { events: { orderBy: { clientTimestamp: "asc" } } } },
        playerMatchStats: true,
        event: { select: { id: true, name: true, hostAcademyId: true } },
      },
    });
    // entrantA/entrantB are plain client-id arrays (BRD's uniform Entrant
    // model for individual/pair/team) — resolve names here so the scoring UI
    // doesn't need a second round trip or a batch-clients endpoint.
    const allClientIds = [...full.entrantA, ...full.entrantB];
    const clients = await this.prisma.client.findMany({
      where: { id: { in: allClientIds } },
      select: { id: true, name: true, academyId: true },
    });
    const byId = new Map(clients.map((c) => [c.id, c]));
    return {
      ...full,
      entrantAClients: full.entrantA.map((id) => byId.get(id) ?? { id, name: "Unknown", academyId: "" }),
      entrantBClients: full.entrantB.map((id) => byId.get(id) ?? { id, name: "Unknown", academyId: "" }),
    };
  }

  async createFixture(academyId: string, dto: CreateFixtureDto) {
    if (dto.eventId) {
      const event = await this.prisma.interschoolEvent.findUnique({ where: { id: dto.eventId } });
      if (!event || event.hostAcademyId !== academyId) {
        throw new ForbiddenException("Only the host academy can create fixtures for this event.");
      }
    } else {
      const allClientIds = [...dto.entrantA, ...dto.entrantB];
      const clients = await this.prisma.client.findMany({ where: { id: { in: allClientIds } } });
      if (clients.length !== allClientIds.length || clients.some((c) => c.academyId !== academyId)) {
        throw new BadRequestException("All entrants must be clients in your academy for a non-event fixture.");
      }
    }
    return this.prisma.fixture.create({
      data: {
        eventId: dto.eventId,
        sportKey: dto.sportKey,
        formatType: dto.formatType,
        entrantA: dto.entrantA,
        entrantB: dto.entrantB,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        venue: dto.venue,
        matchType: dto.matchType ?? (dto.eventId ? "interschool" : "practice"),
        status: "scheduled",
      },
    });
  }

  async abandonFixture(academyId: string, fixtureId: string, reason: string) {
    await this.assertFixtureAccess(academyId, fixtureId);
    return this.prisma.fixture.update({ where: { id: fixtureId }, data: { status: "abandoned", abandonReason: reason } });
  }

  async startSession(academyId: string, fixtureId: string, userId: string) {
    const fixture = await this.assertFixtureAccess(academyId, fixtureId);
    if (fixture.status === "completed" || fixture.status === "abandoned") {
      throw new BadRequestException("This fixture has already been settled.");
    }
    const session = await this.prisma.scoringSession.create({
      data: {
        fixtureId,
        sportKey: fixture.sportKey,
        formatType: fixture.formatType,
        officiatedBy: userId,
        startedAt: new Date(),
      },
    });
    await this.prisma.fixture.update({ where: { id: fixtureId }, data: { status: "live" } });
    return session;
  }

  private async assertSessionAccess(academyId: string, sessionId: string) {
    const session = await this.prisma.scoringSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Scoring session not found.");
    await this.assertFixtureAccess(academyId, session.fixtureId);
    return session;
  }

  async recordScoreEvent(academyId: string, sessionId: string, dto: RecordScoreEventDto, userId: string) {
    await this.assertSessionAccess(academyId, sessionId);
    return this.prisma.scoreEvent.upsert({
      where: { scoringSessionId_clientEventId: { scoringSessionId: sessionId, clientEventId: dto.clientEventId } },
      create: {
        scoringSessionId: sessionId,
        clientEventId: dto.clientEventId,
        actionType: dto.actionType,
        payload: dto.payload as object,
        enteredBy: userId,
        clientTimestamp: new Date(dto.clientTimestamp),
      },
      update: {},
    });
  }

  // BRD 12.6: "Undo must be available for at least the last 3 scoring
  // actions" — implemented as repeatable single-step undo (call 3x to undo
  // 3 actions) rather than a fixed-depth stack, which is simpler and covers
  // the same requirement.
  async undoLastEvent(academyId: string, sessionId: string) {
    await this.assertSessionAccess(academyId, sessionId);
    const last = await this.prisma.scoreEvent.findFirst({
      where: { scoringSessionId: sessionId },
      orderBy: { clientTimestamp: "desc" },
    });
    if (!last) throw new BadRequestException("No actions to undo.");
    await this.prisma.scoreEvent.delete({ where: { id: last.id } });
    return { undone: last };
  }

  async setPaused(academyId: string, sessionId: string, paused: boolean, reason?: string) {
    const session = await this.assertSessionAccess(academyId, sessionId);
    const periodState = (session.periodState as Record<string, unknown>) ?? {};
    return this.prisma.scoringSession.update({
      where: { id: sessionId },
      data: { periodState: { ...periodState, paused, pauseReason: paused ? reason : undefined } as object },
    });
  }

  private async getSideAcademyId(clientIds: string[]): Promise<string | null> {
    const client = await this.prisma.client.findUnique({ where: { id: clientIds[0] } });
    return client?.academyId ?? null;
  }

  private actualScoreForWinnerSide(winnerSide: "A" | "B" | "draw", marginAware: boolean, marginRatio?: number): number {
    if (winnerSide === "draw") return 0.5;
    if (!marginAware || marginRatio === undefined) return winnerSide === "A" ? 1.0 : 0.0;
    const won = winnerSide === "A";
    // marginAwareActualScore expects "won" relative to side A.
    const clamped = Math.min(1, Math.max(0, marginRatio));
    const winnerScore = 0.75 + 0.25 * clamped;
    return won ? winnerScore : 1 - winnerScore;
  }

  // Completes the live scoring session and stores the derived result on the
  // Fixture. Finalization rules are role-aware — see finalizeResult.
  async completeSession(academyId: string, sessionId: string, dto: CompleteSessionDto, by: ResultEnteredBy) {
    const session = await this.assertSessionAccess(academyId, sessionId);
    await this.prisma.scoringSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    return this.finalizeResult(session.fixtureId, dto, { ...by, enteredManually: false });
  }

  // BRD 12.4 manual/retrospective entry — same downstream effects as live
  // scoring, flagged so it's transparent this wasn't scored in real time.
  async enterManualResult(academyId: string, fixtureId: string, dto: CompleteSessionDto, by: ResultEnteredBy) {
    await this.assertFixtureAccess(academyId, fixtureId);
    return this.finalizeResult(fixtureId, dto, { ...by, enteredManually: true });
  }

  // Approval rules (2026-07): a REFEREE's result is final immediately — no
  // confirmation round, any match type. A coach/staff-entered interschool
  // result auto-confirms the scorer's own academy and waits for the OPPONENT
  // school to approve before it completes and rates. Internal ladder and
  // practice matches involve one academy, so no approval round either way.
  private async finalizeResult(
    fixtureId: string,
    dto: CompleteSessionDto,
    meta: { enteredManually: boolean } & ResultEnteredBy
  ) {
    const fixture = await this.prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } });
    const resultSummary = {
      winnerSide: dto.winnerSide,
      scoreDisplay: dto.scoreDisplay,
      marginRatio: dto.marginRatio,
      enteredManually: meta.enteredManually,
      scoredByRole: meta.role,
    };
    const scoredByReferee = meta.role === "referee";
    const needsConfirmation = fixture.matchType === "interschool" && !scoredByReferee;

    const confirmations: ResultConfirmations = (fixture.resultConfirmations as ResultConfirmations) ?? {};
    if (needsConfirmation) {
      confirmations[meta.academyId] = { confirmedBy: meta.userId, confirmedAt: new Date().toISOString() };
    }

    const updated = await this.prisma.fixture.update({
      where: { id: fixtureId },
      data: {
        resultSummary,
        resultConfirmations: confirmations as object,
        status: needsConfirmation ? "pending_confirmation" : "completed",
      },
    });
    // Practice matches never rate; everything else rates when final.
    if (!needsConfirmation && fixture.matchType !== "practice") {
      await this.recalculateRating(updated.id);
    }
    return updated;
  }

  // BRD 11.5 step 7: two-person confirmation (Match Official + opposing
  // school's coach) before a fixture flips to completed. `force` lets an
  // Admin force-confirm with an audit note when a side stalls.
  async confirmFixture(academyId: string, fixtureId: string, userId: string, force = false) {
    const fixture = await this.assertFixtureAccess(academyId, fixtureId);
    if (fixture.status !== "pending_confirmation") {
      throw new BadRequestException("Fixture is not awaiting confirmation.");
    }
    const confirmations: ResultConfirmations = (fixture.resultConfirmations as ResultConfirmations) ?? {};
    confirmations[academyId] = { confirmedBy: userId, confirmedAt: new Date().toISOString() };

    const sideAAcademy = await this.getSideAcademyId(fixture.entrantA);
    const sideBAcademy = await this.getSideAcademyId(fixture.entrantB);
    const requiredAcademies = [sideAAcademy, sideBAcademy].filter((a): a is string => Boolean(a));
    const allConfirmed = force || requiredAcademies.every((a) => confirmations[a]);

    const updated = await this.prisma.fixture.update({
      where: { id: fixtureId },
      data: {
        resultConfirmations: confirmations as object,
        status: allConfirmed ? "completed" : "pending_confirmation",
      },
    });
    if (allConfirmed) {
      await this.recalculateRating(fixtureId);
    }
    return updated;
  }

  // BRD 11.4/11.4.2 — orchestrates the Rating Engine call: builds each side's
  // featured-player list + contribution weights from PlayerMatchStat, derives
  // Actual Score for side A from the stored resultSummary, and delegates the
  // actual Elo math to RatingService (kept as a pure, separately-testable
  // module per BRD 11.8's "recomputable/replayable" requirement).
  private async recalculateRating(fixtureId: string) {
    const fixture = await this.prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } });
    const resultSummary = fixture.resultSummary as { winnerSide: "A" | "B" | "draw"; marginRatio?: number } | null;
    if (!resultSummary) return;

    const template = await this.prisma.scoringTemplate
      .findUnique({ where: { sportKey_formatType: { sportKey: fixture.sportKey, formatType: fixture.formatType } } })
      .catch(() => null);
    const marginAware = Boolean((template?.winCondition as Record<string, unknown> | undefined)?.marginAware);

    const stats = await this.prisma.playerMatchStat.findMany({ where: { fixtureId } });
    const weightFor = (clientId: string) => Number(stats.find((s) => s.clientId === clientId)?.contributionWeight ?? 1.0);

    const actualScoreA = this.actualScoreForWinnerSide(resultSummary.winnerSide, marginAware, resultSummary.marginRatio);

    return this.ratingService.applyMatchResult({
      fixtureId,
      sportKey: fixture.sportKey,
      formatType: fixture.formatType,
      sideA: fixture.entrantA.map((clientId) => ({ clientId, contributionWeight: weightFor(clientId) })),
      sideB: fixture.entrantB.map((clientId) => ({ clientId, contributionWeight: weightFor(clientId) })),
      actualScoreA,
    });
  }

  async setPlayerStats(academyId: string, fixtureId: string, dto: SetPlayerStatsDto) {
    await this.assertFixtureAccess(academyId, fixtureId);
    return this.prisma.$transaction(
      dto.stats.map((s) =>
        this.prisma.playerMatchStat.upsert({
          where: { fixtureId_clientId: { fixtureId, clientId: s.clientId } },
          create: {
            fixtureId,
            clientId: s.clientId,
            statFields: s.statFields as object,
            contributionWeight: s.contributionWeight ?? 1.0,
          },
          update: { statFields: s.statFields as object, contributionWeight: s.contributionWeight ?? 1.0 },
        })
      )
    );
  }
}
