import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { TournamentLoginDto, TournamentSignupDto } from "./dto/tournament-auth.dto";
import type {
  CreateTournamentDto,
  GenerateFixturesDto,
  QuickEntriesDto,
  RegisterEntryDto,
  ScoreMatchDto,
  TimedResultsDto,
  UpdateTournamentDto,
} from "./dto/tournament.dto";

const SALT_ROUNDS = 10;
const PLATFORM_FEE_PCT = 10;

// Tournament users get "t_" prefixed roles so the existing role guard can
// distinguish them from Academy roles without any shared user master.
const T_ROLE = (r: string) => `t_${r}`;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

// Deterministic-enough shuffle for random seeding.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService
  ) {}

  // ── Auth: standalone user master (BRD 5.1) ────────────────────────────────

  async signup(dto: TournamentSignupDto) {
    const existing = await this.prisma.tournamentUser.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("A tournament account with this email already exists.");
    const user = await this.prisma.tournamentUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
        role: dto.role,
        organizationName: dto.organizationName,
      },
    });
    return this.issueToken(user.id, user.role, user.name, user.email, user.organizationName);
  }

  async login(dto: TournamentLoginDto) {
    const user = await this.prisma.tournamentUser.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return this.issueToken(user.id, user.role, user.name, user.email, user.organizationName);
  }

  private issueToken(id: string, role: string, name: string, email: string, organizationName?: string | null) {
    // Long-lived access token; the standalone module has no refresh flow yet.
    const accessToken = this.jwt.sign(
      { sub: id, role: T_ROLE(role), academyId: null },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "7d" as JwtSignOptions["expiresIn"],
      }
    );
    return { accessToken, user: { id, name, email, role, organizationName: organizationName ?? null } };
  }

  // ── Organizer: tournaments (BRD 6.1/6.2) ──────────────────────────────────

  async myTournaments(organizerId: string) {
    const tournaments = await this.prisma.tournament.findMany({
      where: { organizerId },
      include: { events: { include: { _count: { select: { entries: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    // Organizer home top-line stats (BRD 6.1).
    let registrations = 0;
    let collected = 0;
    for (const t of tournaments) {
      for (const e of t.events) registrations += e._count.entries;
    }
    const paid = await this.prisma.tournamentEntry.aggregate({
      where: { event: { tournament: { organizerId } }, paidAmount: { not: null } },
      _sum: { paidAmount: true },
    });
    collected = Number(paid._sum.paidAmount ?? 0);
    return {
      tournaments,
      stats: {
        active: tournaments.filter((t) => t.status === "registration_open" || t.status === "in_progress").length,
        registrations,
        collected,
      },
    };
  }

  async create(organizerId: string, dto: CreateTournamentDto) {
    return this.prisma.tournament.create({
      data: {
        organizerId,
        name: dto.name,
        description: dto.description,
        rules: dto.rules,
        sports: dto.sports,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        venues: dto.venues ?? [],
        allowAtVenuePayment: dto.allowAtVenuePayment ?? false,
        publicSlug: slugify(dto.name),
        platformFeePct: PLATFORM_FEE_PCT,
        events: {
          create: dto.events.map((e) => ({
            name: e.name,
            sportKey: e.sportKey,
            kind: e.kind,
            discipline: e.discipline ?? "match",
            format: e.format ?? "single_elim",
            scoringMode: e.scoringMode ?? (e.discipline === "timed" ? "place" : null),
            standardValue: e.standardValue,
            unit: e.unit ?? "sec",
            entryFee: e.entryFee,
            maxEntrants: e.maxEntrants,
            requiresApproval: e.requiresApproval ?? false,
            category: e.category,
          })),
        },
      },
      include: { events: true },
    });
  }

  private async ownTournamentOrThrow(organizerId: string, tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw new NotFoundException("Tournament not found.");
    if (t.organizerId !== organizerId) throw new ForbiddenException("Not your tournament.");
    return t;
  }

  async update(organizerId: string, tournamentId: string, dto: UpdateTournamentDto) {
    await this.ownTournamentOrThrow(organizerId, tournamentId);
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        description: dto.description,
        rules: dto.rules,
        venues: dto.venues,
        allowAtVenuePayment: dto.allowAtVenuePayment,
      },
    });
  }

  async publish(organizerId: string, tournamentId: string) {
    await this.ownTournamentOrThrow(organizerId, tournamentId);
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "registration_open" },
    });
  }

  async detailForOrganizer(organizerId: string, tournamentId: string) {
    await this.ownTournamentOrThrow(organizerId, tournamentId);
    return this.fullTournament(tournamentId, true);
  }

  // BRD 6.4/6.7 — collected, platform fee, net payable per tournament.
  async paymentSummary(organizerId: string, tournamentId: string) {
    const t = await this.ownTournamentOrThrow(organizerId, tournamentId);
    const paid = await this.prisma.tournamentEntry.aggregate({
      where: { event: { tournamentId }, paidAmount: { not: null } },
      _sum: { paidAmount: true },
      _count: true,
    });
    const collected = Number(paid._sum.paidAmount ?? 0);
    const platformFee = Math.round(collected * Number(t.platformFeePct)) / 100;
    return {
      collected,
      platformFeePct: Number(t.platformFeePct),
      platformFee,
      netPayable: collected - platformFee,
      paidEntries: paid._count,
      payoutStatus: collected > 0 ? "scheduled_next_cycle" : "nothing_due",
    };
  }

  async appointOfficial(organizerId: string, tournamentId: string, email: string) {
    await this.ownTournamentOrThrow(organizerId, tournamentId);
    const user = await this.prisma.tournamentUser.findUnique({ where: { email } });
    if (!user) throw new NotFoundException("No tournament account with that email — ask them to sign up first.");
    return this.prisma.tournamentOfficial.upsert({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
      update: {},
      create: { tournamentId, userId: user.id },
    });
  }

  // ── Registration (BRD 6.3/6.4) ────────────────────────────────────────────

  // Open tournaments any registrant can browse.
  browseOpen() {
    return this.prisma.tournament.findMany({
      where: { status: "registration_open" },
      include: {
        organizer: { select: { name: true, organizationName: true } },
        events: { include: { _count: { select: { entries: true } } } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  private async eventOrThrow(eventId: string) {
    const event = await this.prisma.tournamentEvent.findUnique({
      where: { id: eventId },
      include: { tournament: true },
    });
    if (!event) throw new NotFoundException("Event not found.");
    return event;
  }

  async register(registrantId: string, eventId: string, dto: RegisterEntryDto) {
    const event = await this.eventOrThrow(eventId);
    if (event.tournament.status !== "registration_open") {
      throw new BadRequestException("Registration for this tournament is not open.");
    }
    if (event.kind === "team" && !dto.teamName) {
      throw new BadRequestException("A team event registration needs a team name.");
    }

    const confirmedish = await this.prisma.tournamentEntry.count({
      where: { eventId, status: { in: ["pending", "awaiting_payment", "confirmed"] } },
    });
    // Waitlist when the event is full (BRD 6.3).
    const waitlisted = event.maxEntrants != null && confirmedish >= event.maxEntrants;

    const hasFee = event.entryFee != null && Number(event.entryFee) > 0;
    const status = waitlisted
      ? "waitlisted"
      : event.requiresApproval
        ? "pending"
        : hasFee
          ? "awaiting_payment"
          : "confirmed";

    return this.prisma.tournamentEntry.create({
      data: {
        eventId,
        registrantId,
        teamName: dto.teamName,
        players: dto.players as object[],
        status,
      },
    });
  }

  // Mock payment gateway (card/UPI) — Pending → Confirmed only once payment
  // clears (BRD 6.4). Swap for the real gateway at production.
  async payEntry(registrantId: string, entryId: string) {
    const entry = await this.prisma.tournamentEntry.findUnique({
      where: { id: entryId },
      include: { event: true },
    });
    if (!entry) throw new NotFoundException("Entry not found.");
    if (entry.registrantId !== registrantId) throw new ForbiddenException("Not your entry.");
    if (entry.status === "confirmed") return entry;
    if (entry.status === "waitlisted") throw new BadRequestException("This entry is waitlisted — you'll be offered a spot if one opens.");
    if (entry.status === "pending") throw new BadRequestException("Awaiting organizer approval before payment.");
    return this.prisma.tournamentEntry.update({
      where: { id: entryId },
      data: { status: "confirmed", paidAmount: entry.event.entryFee, paidAt: new Date() },
    });
  }

  async approveEntry(organizerId: string, entryId: string, approve: boolean) {
    const entry = await this.prisma.tournamentEntry.findUnique({
      where: { id: entryId },
      include: { event: { include: { tournament: true } } },
    });
    if (!entry) throw new NotFoundException("Entry not found.");
    if (entry.event.tournament.organizerId !== organizerId) throw new ForbiddenException();
    if (!approve) return this.prisma.tournamentEntry.update({ where: { id: entryId }, data: { status: "rejected" } });
    const hasFee = entry.event.entryFee != null && Number(entry.event.entryFee) > 0;
    return this.prisma.tournamentEntry.update({
      where: { id: entryId },
      data: { status: hasFee ? "awaiting_payment" : "confirmed" },
    });
  }

  async withdrawEntry(organizerId: string, entryId: string) {
    const entry = await this.prisma.tournamentEntry.findUnique({
      where: { id: entryId },
      include: { event: { include: { tournament: true } } },
    });
    if (!entry) throw new NotFoundException("Entry not found.");
    if (entry.event.tournament.organizerId !== organizerId) throw new ForbiddenException();
    const updated = await this.prisma.tournamentEntry.update({
      where: { id: entryId },
      data: { status: "withdrawn" },
    });
    // Offer the freed spot to the first waitlisted entry (BRD 6.3).
    const next = await this.prisma.tournamentEntry.findFirst({
      where: { eventId: entry.eventId, status: "waitlisted" },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      const hasFee = entry.event.entryFee != null && Number(entry.event.entryFee) > 0;
      await this.prisma.tournamentEntry.update({
        where: { id: next.id },
        data: { status: entry.event.requiresApproval ? "pending" : hasFee ? "awaiting_payment" : "confirmed" },
      });
    }
    return updated;
  }

  // Quick Tournament fast path (BRD 6.3): paste names, entries appear
  // confirmed immediately — bracket in under a minute.
  async quickEntries(organizerId: string, eventId: string, dto: QuickEntriesDto) {
    const event = await this.eventOrThrow(eventId);
    if (event.tournament.organizerId !== organizerId) throw new ForbiddenException();
    const created = [];
    for (const name of dto.names.map((n) => n.trim()).filter(Boolean)) {
      created.push(
        await this.prisma.tournamentEntry.create({
          data: {
            eventId,
            teamName: event.kind === "team" ? name : null,
            players: [{ name }] as object[],
            status: "confirmed",
          },
        })
      );
    }
    return created;
  }

  // My entries (registrant home).
  myEntries(registrantId: string) {
    return this.prisma.tournamentEntry.findMany({
      where: { registrantId },
      include: { event: { include: { tournament: { select: { id: true, name: true, publicSlug: true, status: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Fixture generation (BRD 6.5) ──────────────────────────────────────────

  async generateFixtures(organizerId: string, eventId: string, dto: GenerateFixturesDto) {
    const event = await this.eventOrThrow(eventId);
    if (event.tournament.organizerId !== organizerId) throw new ForbiddenException();
    if (event.discipline === "timed") {
      throw new BadRequestException("Timed events use heats and recorded results, not fixtures.");
    }
    const existing = await this.prisma.tournamentMatch.count({ where: { eventId } });
    if (existing > 0) throw new BadRequestException("Fixtures already generated for this event.");

    const entries = await this.prisma.tournamentEntry.findMany({
      where: { eventId, status: "confirmed" },
      orderBy: { createdAt: "asc" },
    });
    if (entries.length < 2) throw new BadRequestException("Need at least 2 confirmed entries.");

    // Seeding (BRD 6.5): fixed seeds first (they get the byes), rest random.
    let ordered = entries;
    if (dto.seedOrder?.length) {
      const seedRank = new Map(dto.seedOrder.map((id, i) => [id, i]));
      const seeded = entries.filter((e) => seedRank.has(e.id)).sort((a, b) => seedRank.get(a.id)! - seedRank.get(b.id)!);
      const rest = shuffle(entries.filter((e) => !seedRank.has(e.id)));
      ordered = [...seeded, ...rest];
      for (let i = 0; i < seeded.length; i++) {
        await this.prisma.tournamentEntry.update({ where: { id: seeded[i].id }, data: { seed: i + 1 } });
      }
    } else {
      ordered = shuffle(entries);
    }

    const venues = event.tournament.venues.length ? event.tournament.venues : [null];
    let venueIdx = 0;
    const nextVenue = () => venues[venueIdx++ % venues.length];

    if (event.format === "round_robin" || event.format === "league") {
      // Every pair meets once via the circle method; a league runs the whole
      // schedule twice with home/away swapped (double round robin).
      const legs = event.format === "league" ? 2 : 1;
      const list: (typeof ordered)[number][] = [...ordered];
      const oddBye = list.length % 2 === 1;
      const n = oddBye ? list.length + 1 : list.length;
      const rounds = n - 1;
      let matchNo = 1;
      for (let leg = 0; leg < legs; leg++) {
        for (let r = 0; r < rounds; r++) {
          for (let i = 0; i < n / 2; i++) {
            const aIdx = (r + i) % (n - 1);
            const bIdx = i === 0 ? n - 1 : (r + n - 1 - i) % (n - 1);
            const a = list[aIdx];
            const b = bIdx === n - 1 && oddBye ? undefined : list[bIdx === n - 1 ? n - 1 : bIdx];
            if (!a || !b || a.id === b.id) continue;
            const [home, away] = leg === 0 ? [a, b] : [b, a];
            await this.prisma.tournamentMatch.create({
              data: {
                eventId,
                round: leg * rounds + r + 1,
                matchNo: matchNo++,
                entryAId: home.id,
                entryBId: away.id,
                venue: nextVenue(),
              },
            });
          }
        }
      }
    } else {
      // Single elimination with byes: bracket size = next power of two; the
      // top-ordered entrants "pass over" round 1 when byes exist.
      const size = 2 ** Math.ceil(Math.log2(ordered.length));
      const slots: (string | null)[] = Array(size).fill(null);
      // Standard seed placement: 1 at top, 2 at bottom, then spread.
      const placement = (seedIdx: number, lo: number, hi: number): number => {
        if (hi - lo === 1) return lo;
        const half = (hi - lo) / 2;
        if (seedIdx % 2 === 0) return placement(Math.floor(seedIdx / 2), lo, lo + half);
        return placement(Math.floor(seedIdx / 2), hi - half, hi);
      };
      ordered.forEach((e, i) => {
        slots[placement(i, 0, size)] = e.id;
      });

      const rounds = Math.log2(size);
      // Create all matches round-by-round, wiring the winner-advance chain.
      const byRound: { id: string }[][] = [];
      let matchNo = 1;
      for (let r = 1; r <= rounds; r++) {
        const count = size / 2 ** r;
        const roundMatches: { id: string }[] = [];
        for (let m = 0; m < count; m++) {
          const match = await this.prisma.tournamentMatch.create({
            data: {
              eventId,
              round: r,
              matchNo: matchNo++,
              entryAId: r === 1 ? slots[m * 2] : null,
              entryBId: r === 1 ? slots[m * 2 + 1] : null,
              venue: nextVenue(),
            },
          });
          roundMatches.push(match);
        }
        byRound.push(roundMatches);
      }
      for (let r = 0; r < byRound.length - 1; r++) {
        for (let m = 0; m < byRound[r].length; m++) {
          await this.prisma.tournamentMatch.update({
            where: { id: byRound[r][m].id },
            data: { nextMatchId: byRound[r + 1][Math.floor(m / 2)].id, slotInNext: m % 2 === 0 ? "A" : "B" },
          });
        }
      }
      // Resolve byes: a round-1 match with one empty slot auto-advances.
      for (const m of byRound[0]) {
        const match = await this.prisma.tournamentMatch.findUnique({ where: { id: m.id } });
        if (match && ((match.entryAId && !match.entryBId) || (!match.entryAId && match.entryBId))) {
          await this.completeMatchInternal(match.id, match.entryAId ? 1 : 0, match.entryBId ? 1 : 0, "bye");
        }
      }
    }

    await this.prisma.tournament.update({
      where: { id: event.tournamentId },
      data: { status: "in_progress" },
    });
    return this.prisma.tournamentMatch.findMany({ where: { eventId }, orderBy: [{ round: "asc" }, { matchNo: "asc" }] });
  }

  // ── Scoring (BRD 7) ───────────────────────────────────────────────────────

  private async assertCanScore(userId: string, role: string, matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { event: { include: { tournament: { include: { officials: true } } } } },
    });
    if (!match) throw new NotFoundException("Match not found.");
    const t = match.event.tournament;
    const isOrganizer = t.organizerId === userId;
    const isOfficial = t.officials.some((o) => o.userId === userId);
    if (!isOrganizer && !isOfficial) throw new ForbiddenException("Only the organizer or an appointed official can score.");
    return match;
  }

  async scoreMatch(userId: string, role: string, matchId: string, dto: ScoreMatchDto) {
    const match = await this.assertCanScore(userId, role, matchId);
    if (match.status === "completed") throw new BadRequestException("Match already completed.");
    if (!match.entryAId || !match.entryBId) throw new BadRequestException("Both slots must be filled before scoring.");

    if (!dto.final) {
      // Live update — feeds the public page's live scores (BRD 7.5/6.6).
      return this.prisma.tournamentMatch.update({
        where: { id: matchId },
        data: { status: "live", scoreA: dto.scoreA, scoreB: dto.scoreB, officialId: userId },
      });
    }
    if (dto.scoreA === dto.scoreB) throw new BadRequestException("A knockout/league match needs a winner — enter a decider.");
    return this.completeMatchInternal(matchId, dto.scoreA, dto.scoreB, dto.scoreDisplay, userId);
  }

  private async completeMatchInternal(matchId: string, scoreA: number, scoreB: number, display?: string, officialId?: string) {
    const match = await this.prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
    const winnerEntryId = scoreA > scoreB ? match.entryAId : match.entryBId;
    const updated = await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: "completed",
        scoreA,
        scoreB,
        scoreDisplay: display,
        winnerEntryId,
        officialId: officialId ?? match.officialId,
      },
    });
    // Winner advances into the next bracket slot (standings/brackets update
    // the moment a match is confirmed — BRD 6.6).
    if (updated.nextMatchId && winnerEntryId) {
      await this.prisma.tournamentMatch.update({
        where: { id: updated.nextMatchId },
        data: updated.slotInNext === "A" ? { entryAId: winnerEntryId } : { entryBId: winnerEntryId },
      });
    }
    return updated;
  }

  // ── Timed / measured events (BRD 7.4) ─────────────────────────────────────

  async recordTimedResults(userId: string, role: string, eventId: string, dto: TimedResultsDto) {
    const event = await this.eventOrThrow(eventId);
    const officials = await this.prisma.tournamentOfficial.findMany({ where: { tournamentId: event.tournamentId } });
    const allowed = event.tournament.organizerId === userId || officials.some((o) => o.userId === userId);
    if (!allowed) throw new ForbiddenException("Only the organizer or an appointed official can record results.");
    if (event.discipline !== "timed") throw new BadRequestException("This event is scored as matches, not times.");

    const saved = [];
    for (const r of dto.results) {
      saved.push(
        await this.prisma.tournamentTimedResult.upsert({
          where: {
            eventId_entryId_phase_heat: {
              eventId,
              entryId: r.entryId,
              phase: r.phase ?? "heat",
              heat: r.heat ?? 1,
            },
          },
          update: { value: r.value, dq: r.dq ?? false },
          create: { eventId, entryId: r.entryId, phase: r.phase ?? "heat", heat: r.heat ?? 1, value: r.value, dq: r.dq ?? false },
        })
      );
    }
    return saved;
  }

  // Heats pool into a ranked list; the top N seed the Final (BRD 7.4) —
  // exactly as groups cross-seed a knockout.
  async timedRanking(eventId: string, phase: "heat" | "final") {
    const event = await this.prisma.tournamentEvent.findUniqueOrThrow({ where: { id: eventId } });
    const results = await this.prisma.tournamentTimedResult.findMany({
      where: { eventId, phase, dq: false },
      include: { entry: true },
    });
    // Lowest time wins; longest distance wins.
    const asc = event.unit === "sec";
    const ranked = results
      .sort((a, b) => (asc ? Number(a.value) - Number(b.value) : Number(b.value) - Number(a.value)))
      .map((r, i) => ({
        rank: i + 1,
        entryId: r.entryId,
        name: r.entry.teamName ?? (r.entry.players as { name: string }[])[0]?.name ?? "—",
        value: Number(r.value),
        unit: event.unit,
        heat: r.heat,
        // Standards-based mode compares against the benchmark (BRD 7.4).
        meetsStandard:
          event.scoringMode === "standards" && event.standardValue != null
            ? asc
              ? Number(r.value) <= Number(event.standardValue)
              : Number(r.value) >= Number(event.standardValue)
            : undefined,
      }));
    return ranked;
  }

  // ── Standings + public microsite (BRD 6.6, no auth) ───────────────────────

  async standings(eventId: string) {
    const matches = await this.prisma.tournamentMatch.findMany({
      where: { eventId, status: "completed" },
    });
    const entries = await this.prisma.tournamentEntry.findMany({ where: { eventId, status: "confirmed" } });
    const rows = new Map(
      entries.map((e) => [
        e.id,
        {
          entryId: e.id,
          name: e.teamName ?? (e.players as { name: string }[])[0]?.name ?? "—",
          seed: e.seed,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          scoreFor: 0,
          scoreAgainst: 0,
        },
      ])
    );
    for (const m of matches) {
      if (m.scoreDisplay === "bye") continue;
      const a = m.entryAId ? rows.get(m.entryAId) : null;
      const b = m.entryBId ? rows.get(m.entryBId) : null;
      if (a) { a.played++; a.scoreFor += m.scoreA; a.scoreAgainst += m.scoreB; }
      if (b) { b.played++; b.scoreFor += m.scoreB; b.scoreAgainst += m.scoreA; }
      if (m.winnerEntryId && rows.get(m.winnerEntryId)) {
        rows.get(m.winnerEntryId)!.won++;
        rows.get(m.winnerEntryId)!.points += 2;
        const loser = m.winnerEntryId === m.entryAId ? b : a;
        if (loser) loser.lost++;
      }
    }
    return [...rows.values()].sort(
      (x, y) => y.points - x.points || y.scoreFor - y.scoreAgainst - (x.scoreFor - x.scoreAgainst)
    );
  }

  private async fullTournament(tournamentId: string, includePrivate: boolean) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        organizer: { select: { name: true, organizationName: true } },
        officials: { include: { user: { select: { id: true, name: true, email: true } } } },
        events: {
          include: {
            entries: includePrivate ? true : { where: { status: "confirmed" } },
            matches: { orderBy: [{ round: "asc" }, { matchNo: "asc" }] },
            timedResults: true,
          },
        },
      },
    });
    if (!t) throw new NotFoundException("Tournament not found.");
    const events = [];
    for (const e of t.events) {
      events.push({
        ...e,
        standings: e.discipline === "match" ? await this.standings(e.id) : undefined,
        heatRanking: e.discipline === "timed" ? await this.timedRanking(e.id, "heat") : undefined,
        finalRanking: e.discipline === "timed" ? await this.timedRanking(e.id, "final") : undefined,
      });
    }
    return { ...t, events };
  }

  // Fully public — viewable and shareable with no Whistle account and no app
  // installed (BRD acceptance criterion 4).
  async publicPage(slug: string) {
    const t = await this.prisma.tournament.findUnique({ where: { publicSlug: slug } });
    if (!t) throw new NotFoundException("Tournament not found.");
    const full = await this.fullTournament(t.id, false);
    // Strip anything private (contacts, officials' emails).
    return {
      name: full.name,
      description: full.description,
      rules: full.rules,
      sports: full.sports,
      status: full.status,
      startDate: full.startDate,
      endDate: full.endDate,
      venues: full.venues,
      organizer: full.organizer.organizationName ?? full.organizer.name,
      events: full.events.map((e) => ({
        id: e.id,
        name: e.name,
        sportKey: e.sportKey,
        kind: e.kind,
        discipline: e.discipline,
        format: e.format,
        entryFee: e.entryFee,
        entries: (e.entries as { id: string; teamName: string | null; players: unknown; seed: number | null }[]).map(
          (en) => ({
            id: en.id,
            name: en.teamName ?? (en.players as { name: string }[])[0]?.name ?? "—",
            seed: en.seed,
          })
        ),
        matches: e.matches.map((m) => ({
          round: m.round,
          matchNo: m.matchNo,
          entryAId: m.entryAId,
          entryBId: m.entryBId,
          status: m.status,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          scoreDisplay: m.scoreDisplay,
          winnerEntryId: m.winnerEntryId,
          venue: m.venue,
        })),
        standings: e.standings,
        heatRanking: e.heatRanking,
        finalRanking: e.finalRanking,
      })),
    };
  }
}
