import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { FormatType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  SKILL_LEVEL_SEED,
  applySideUpdate,
  averageRating,
  clampRating,
  confidenceFor,
  expectedScore,
  reliabilityPct,
  type SideUpdateInput,
  type SkillLevelSeed,
} from "./rating-math";
import type { OverrideRatingDto } from "./dto/override-rating.dto";

export interface MatchSide {
  clientId: string;
  contributionWeight?: number;
}

export interface ApplyMatchResultParams {
  fixtureId: string;
  sportKey: string;
  formatType: FormatType;
  sideA: MatchSide[];
  sideB: MatchSide[];
  // Actual score for side A: 1.0 win, 0.0 loss, 0.5 draw, or a margin-aware
  // value in between (BRD 11.4.3). Side B's actual score is always 1 - actualA.
  actualScoreA: number;
}

@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  // Parents/students (the Parent app's "My Rating" screen) may only ever
  // view a client they're actually linked to — staff roles bypass this
  // entirely (RolesGuard already restricts which roles reach this service).
  async assertViewableBy(userId: string, role: string, clientId: string) {
    if (role !== "parent" && role !== "student") return;
    const guardian = await this.prisma.clientGuardian.findUnique({
      where: { clientId_userId: { clientId, userId } },
    });
    if (!guardian) throw new ForbiddenException("Not linked to this player.");
  }

  // Addendum v3 Section 3.1 — attaches the additive numeric Reliability Score
  // to any Rating row headed to a client; whether the frontend displays it is
  // gated by the academy's "Show numeric reliability score" toggle, not by
  // whether this field is present (cheap to compute, so always included).
  private withReliability<T extends { matchesPlayed: number; lastUpdatedAt: Date }>(rating: T): T & { reliabilityPct: number } {
    return { ...rating, reliabilityPct: reliabilityPct(rating.matchesPlayed, rating.lastUpdatedAt) };
  }

  async getOrSeedRating(clientId: string, sportKey: string, formatType: FormatType) {
    const existing = await this.prisma.rating.findUnique({
      where: { clientId_sportKey_formatType: { clientId, sportKey, formatType } },
    });
    if (existing) return this.withReliability(existing);

    const skillLevel = await this.prisma.clientSkillLevel.findUnique({
      where: { clientId_sportKey: { clientId, sportKey } },
    });
    if (!skillLevel) {
      throw new BadRequestException(
        `Client has no academy Skill Level set for ${sportKey} — required before entering the rating network (BRD 11.8).`
      );
    }
    const seed = SKILL_LEVEL_SEED[skillLevel.level as SkillLevelSeed] ?? SKILL_LEVEL_SEED.beginner;
    const created = await this.prisma.rating.create({
      data: {
        clientId,
        sportKey,
        formatType,
        currentRating: seed.rating,
        kFactorCurrent: seed.kFactor,
        matchesPlayed: 0,
        isProvisional: true,
        confidence: "low",
      },
    });
    return this.withReliability(created);
  }

  async getRating(clientId: string, sportKey: string, formatType: FormatType) {
    const rating = await this.prisma.rating.findUnique({
      where: { clientId_sportKey_formatType: { clientId, sportKey, formatType } },
    });
    if (!rating) throw new NotFoundException("No rating found for this client/sport/format.");
    return this.withReliability(rating);
  }

  history(clientId: string, sportKey: string, formatType: FormatType) {
    return this.prisma.ratingTransaction.findMany({
      where: { clientId, sportKey, formatType },
      orderBy: { createdAt: "desc" },
      include: { fixture: { select: { id: true, scheduledAt: true, matchType: true, entrantA: true, entrantB: true } } },
    });
  }

  // BRD 11.4 — the core Elo/DUPR update. Computes each side's average rating
  // (BRD 11.4.2: team rating = average of featured players, not the whole
  // squad), the Expected score from the rating gap, then moves every
  // featured player's own rating by their own K × contributionWeight ×
  // (actual - expected) — one RatingTransaction row per featured player
  // (BRD 11.8 acceptance criterion).
  async applyMatchResult(params: ApplyMatchResultParams) {
    const { fixtureId, sportKey, formatType, sideA, sideB, actualScoreA } = params;
    if (sideA.length === 0 || sideB.length === 0) {
      throw new BadRequestException("Both sides must have at least one featured player to rate.");
    }

    const ratingsA = await Promise.all(sideA.map((p) => this.getOrSeedRating(p.clientId, sportKey, formatType)));
    const ratingsB = await Promise.all(sideB.map((p) => this.getOrSeedRating(p.clientId, sportKey, formatType)));

    const avgA = averageRating(ratingsA.map((r) => ({ preRating: Number(r.currentRating) })));
    const avgB = averageRating(ratingsB.map((r) => ({ preRating: Number(r.currentRating) })));
    const expectedA = expectedScore(avgA, avgB);
    const expectedB = 1 - expectedA;
    const actualB = 1 - actualScoreA;

    const inputsA: SideUpdateInput[] = sideA.map((p, i) => ({
      clientId: p.clientId,
      preRating: Number(ratingsA[i].currentRating),
      kFactorCurrent: Number(ratingsA[i].kFactorCurrent),
      matchesPlayed: ratingsA[i].matchesPlayed,
      contributionWeight: p.contributionWeight ?? 1.0,
    }));
    const inputsB: SideUpdateInput[] = sideB.map((p, i) => ({
      clientId: p.clientId,
      preRating: Number(ratingsB[i].currentRating),
      kFactorCurrent: Number(ratingsB[i].kFactorCurrent),
      matchesPlayed: ratingsB[i].matchesPlayed,
      contributionWeight: p.contributionWeight ?? 1.0,
    }));

    const updatesA = applySideUpdate(inputsA, expectedA, actualScoreA);
    const updatesB = applySideUpdate(inputsB, expectedB, actualB);

    const transactions = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const u of [...updatesA, ...updatesB]) {
        await tx.rating.update({
          where: { clientId_sportKey_formatType: { clientId: u.clientId, sportKey, formatType } },
          data: {
            currentRating: u.postRating,
            matchesPlayed: u.newMatchesPlayed,
            kFactorCurrent: u.newKFactorCurrent,
            isProvisional: u.newMatchesPlayed < 5,
            confidence: confidenceFor(u.newMatchesPlayed),
            lastUpdatedAt: new Date(),
          },
        });
        const txn = await tx.ratingTransaction.create({
          data: {
            clientId: u.clientId,
            sportKey,
            formatType,
            fixtureId,
            preRating: u.preRating,
            postRating: u.postRating,
            expectedScore: u.expectedScore,
            actualScore: u.actualScore,
            kFactorUsed: u.kFactorCurrent,
            contributionWeight: u.contributionWeight,
          },
        });
        created.push(txn);
      }
      return created;
    });

    // BRD 11.2 — refresh each involved academy's School Rating aggregate so
    // school (team) standings track every rated match.
    const allClientIds = [...sideA, ...sideB].map((p) => p.clientId);
    const clients = await this.prisma.client.findMany({
      where: { id: { in: allClientIds } },
      select: { academyId: true },
    });
    for (const academyId of new Set(clients.map((c) => c.academyId))) {
      await this.recomputeSchoolRating(academyId, sportKey);
    }

    return transactions;
  }

  // BRD 11.3 — Admin override of a student's starting rating, only before
  // their first rated match, bounded ±0.5 from the skill-level-mapped seed,
  // always logged with actor/reason (BRD 11.8).
  async overrideStartingRating(
    clientId: string,
    sportKey: string,
    formatType: FormatType,
    dto: OverrideRatingDto,
    actorUserId: string
  ) {
    const rating = await this.getOrSeedRating(clientId, sportKey, formatType);
    if (rating.matchesPlayed > 0) {
      throw new ForbiddenException("Rating is system-governed once a match has been recorded — override window has closed.");
    }
    const skillLevel = await this.prisma.clientSkillLevel.findUniqueOrThrow({
      where: { clientId_sportKey: { clientId, sportKey } },
    });
    const seed = SKILL_LEVEL_SEED[skillLevel.level as SkillLevelSeed] ?? SKILL_LEVEL_SEED.beginner;
    if (Math.abs(dto.rating - seed.rating) > 0.5) {
      throw new BadRequestException(`Override must be within ±0.5 of the mapped starting rating (${seed.rating}).`);
    }
    const clamped = clampRating(dto.rating);

    return this.prisma.$transaction(async (tx) => {
      await tx.rating.update({
        where: { clientId_sportKey_formatType: { clientId, sportKey, formatType } },
        data: { currentRating: clamped, lastUpdatedAt: new Date() },
      });
      return tx.ratingTransaction.create({
        data: {
          clientId,
          sportKey,
          formatType,
          preRating: rating.currentRating,
          postRating: clamped,
          expectedScore: 0,
          actualScore: 0,
          kFactorUsed: 0,
          overrideReason: dto.reason,
          overriddenBy: actorUserId,
        },
      });
    });
  }

  // BRD 11.2 School Rating — "participation-weighted average of active
  // players' individual ratings". No explicit weighting formula is given
  // beyond "participation-weighted"; this uses matchesPlayed as the weight
  // (a player with more rated matches counts more), which is the simplest
  // reading of that phrase and is fully recomputable from stored Ratings.
  async recomputeSchoolRating(academyId: string, sportKey: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { sportKey, client: { academyId } },
    });
    if (ratings.length === 0) {
      return this.prisma.schoolRating.upsert({
        where: { academyId_sportKey: { academyId, sportKey } },
        create: { academyId, sportKey, aggregateRating: null },
        update: { aggregateRating: null, computedAt: new Date() },
      });
    }
    const totalWeight = ratings.reduce((sum, r) => sum + Math.max(1, r.matchesPlayed), 0);
    const weighted = ratings.reduce((sum, r) => sum + Number(r.currentRating) * Math.max(1, r.matchesPlayed), 0);
    const aggregate = Math.round((weighted / totalWeight) * 100) / 100;
    return this.prisma.schoolRating.upsert({
      where: { academyId_sportKey: { academyId, sportKey } },
      create: { academyId, sportKey, aggregateRating: aggregate },
      update: { aggregateRating: aggregate, computedAt: new Date() },
    });
  }

  async studentLeaderboard(sportKey: string, formatType: FormatType, academyId?: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { sportKey, formatType, ...(academyId ? { client: { academyId } } : {}) },
      include: {
        client: { select: { id: true, name: true, academyId: true, dob: true, academy: { select: { name: true } } } },
      },
      orderBy: { currentRating: "desc" },
      take: 100,
    });
    return ratings.map((r) => this.withReliability(r));
  }

  schoolLeaderboard(sportKey: string) {
    return this.prisma.schoolRating.findMany({
      where: { sportKey },
      include: { academy: { select: { id: true, name: true } } },
      orderBy: { aggregateRating: "desc" },
    });
  }

  // BRD 11.8 — ratings must be recomputable by replaying the stored
  // RatingTransactions in order. Folds each rating's transaction log and
  // repairs any drift in the live row (late fixture corrections, bug-fix
  // backfills). Idempotent, so safe to run as a queued job.
  async recomputeFromTransactions(sportKey?: string) {
    const ratings = await this.prisma.rating.findMany({
      where: sportKey ? { sportKey } : {},
      select: { clientId: true, sportKey: true, formatType: true, currentRating: true, matchesPlayed: true },
    });

    let repaired = 0;
    for (const r of ratings) {
      const txs = await this.prisma.ratingTransaction.findMany({
        where: { clientId: r.clientId, sportKey: r.sportKey, formatType: r.formatType },
        orderBy: { createdAt: "asc" },
        select: { postRating: true, fixtureId: true },
      });
      if (txs.length === 0) continue; // seeded-only rating, nothing to replay

      const expectedRating = Number(txs[txs.length - 1].postRating);
      // Manual overrides (fixtureId null) adjust the rating but are not matches.
      const expectedMatches = txs.filter((t) => t.fixtureId !== null).length;

      if (Number(r.currentRating) !== expectedRating || r.matchesPlayed !== expectedMatches) {
        await this.prisma.rating.update({
          where: {
            clientId_sportKey_formatType: {
              clientId: r.clientId,
              sportKey: r.sportKey,
              formatType: r.formatType,
            },
          },
          data: { currentRating: expectedRating, matchesPlayed: expectedMatches },
        });
        repaired++;
      }
    }
    return { checked: ratings.length, repaired };
  }
}
