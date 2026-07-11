import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { EventStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { reliabilityPct } from "../rating/rating-math";
import { InvoicesService } from "../invoices/invoices.service";
import type { CreateEventDto } from "./dto/create-event.dto";
import type { UpdateEventDto } from "./dto/update-event.dto";
import type { InviteSchoolsDto } from "./dto/invite-schools.dto";
import type { RespondInvitationDto } from "./dto/respond-invitation.dto";
import type { NominateRosterDto } from "./dto/nominate-roster.dto";

interface AcademySettingsShape {
  interschool?: { showReliabilityScore?: boolean };
}

// BRD 11.2 age bands are written "U-8"/"U-10"/... ("Under N"); this parses
// the numeric cutoff so a client's age (computed from dob as of the event's
// start date) can be checked against the bands an event declares.
function ageBandMaxAge(band: string): number | null {
  const match = band.match(/U-?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function ageAsOf(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

// Great-circle distance in km — ranks discovered events by how far the host
// academy's nearest pinned center is from the coach's own center (2026-07).
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class InterschoolService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService
  ) {}

  async getSettings(academyId: string) {
    const academy = await this.prisma.academy.findUniqueOrThrow({
      where: { id: academyId },
      select: { id: true, name: true, networkOptIn: true, settings: true },
    });
    const settings = (academy.settings as AcademySettingsShape | null) ?? {};
    return {
      id: academy.id,
      name: academy.name,
      networkOptIn: academy.networkOptIn,
      showReliabilityScore: settings.interschool?.showReliabilityScore ?? false,
    };
  }

  updateSettings(academyId: string, networkOptIn: boolean) {
    return this.prisma.academy.update({ where: { id: academyId }, data: { networkOptIn } });
  }

  // Addendum v3 Section 3.1 — off by default; reuses the same Academy.settings
  // JSON bucket as WhatsApp/Policies settings elsewhere in the product.
  async updateReliabilityToggle(academyId: string, showReliabilityScore: boolean) {
    const academy = await this.prisma.academy.findUniqueOrThrow({ where: { id: academyId } });
    const current = (academy.settings as AcademySettingsShape | null) ?? {};
    await this.prisma.academy.update({
      where: { id: academyId },
      data: { settings: { ...current, interschool: { ...current.interschool, showReliabilityScore } } as object },
    });
    return this.getSettings(academyId);
  }

  memberSchools(academyId: string) {
    return this.prisma.academy.findMany({
      where: { networkOptIn: true, id: { not: academyId } },
      select: { id: true, name: true, centers: { select: { id: true, name: true } }, schoolRatings: true },
      orderBy: { name: "asc" },
    });
  }

  async findEvents(academyId: string, status?: EventStatus, scope?: "mine" | "discover", userId?: string) {
    // "discover" = published (scheduled/live) events hosted by OTHER academies
    // in the interschool network — how coaches find game days around them.
    // Default remains: own-hosted or accepted-invitation events only.
    const where =
      scope === "discover"
        ? {
            hostAcademyId: { not: academyId },
            status: status ?? { in: ["scheduled", "live"] as EventStatus[] },
            // Discoverable when the host either opted the whole academy into
            // the network OR explicitly listed this as an open Match Center
            // event with team slots (maxTeams) — the act of setting a cap and
            // publishing IS opting that event in for open discovery/join.
            OR: [{ hostAcademy: { networkOptIn: true } }, { maxTeams: { not: null } }],
          }
        : {
            ...(status ? { status } : {}),
            OR: [
              { hostAcademyId: academyId },
              { invitations: { some: { invitedAcademyId: academyId, status: "accepted" as const } } },
            ],
          };
    const rawEvents = await this.prisma.interschoolEvent.findMany({
      where,
      include: {
        hostAcademy: { select: { id: true, name: true } },
        invitations: { select: { status: true, invitedAcademyId: true } },
        _count: { select: { fixtures: true, invitations: true } },
      },
      orderBy: { startDate: "desc" },
    });
    // Team slots: host + accepted schools, against the listing's maxTeams cap.
    const events = rawEvents.map(({ invitations, ...e }) => ({
      ...e,
      teamsJoined: 1 + invitations.filter((i) => i.status === "accepted").length,
      myAcademyJoined: invitations.some((i) => i.invitedAcademyId === academyId && i.status === "accepted"),
    }));
    // Discovery is ranked by distance from the coach's own center pin
    // (2026-07): nearest host first; hosts with no pinned center sort last.
    if (scope === "discover" && userId) {
      const me = await this.coachCenterPin(academyId, userId);
      if (me) {
        const hostIds = [...new Set(events.map((e) => e.hostAcademyId))];
        const hostCenters = await this.prisma.center.findMany({
          where: { academyId: { in: hostIds }, geoLat: { not: null }, geoLng: { not: null } },
          select: { academyId: true, geoLat: true, geoLng: true, name: true },
        });
        const withDistance = events.map((e) => {
          let best: { km: number; center: string } | null = null;
          for (const c of hostCenters.filter((x) => x.academyId === e.hostAcademyId)) {
            const km = Math.round(haversineKm(me.lat, me.lng, Number(c.geoLat), Number(c.geoLng)) * 10) / 10;
            if (!best || km < best.km) best = { km, center: c.name };
          }
          return { ...e, distanceKm: best?.km ?? null, nearestVenue: best?.center ?? null };
        });
        return withDistance.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
      }
    }
    return events;
  }

  // The coach's location = their assigned center's pin, else the academy's
  // first pinned center.
  private async coachCenterPin(academyId: string, userId: string): Promise<{ lat: number; lng: number } | null> {
    const profile = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: { center: { select: { geoLat: true, geoLng: true } } },
    });
    let geo: { geoLat: unknown; geoLng: unknown } | null | undefined = profile?.center;
    if (!geo?.geoLat || !geo?.geoLng) {
      geo = await this.prisma.center.findFirst({
        where: { academyId, geoLat: { not: null }, geoLng: { not: null } },
        select: { geoLat: true, geoLng: true },
      });
    }
    if (!geo?.geoLat || !geo?.geoLng) return null;
    return { lat: Number(geo.geoLat), lng: Number(geo.geoLng) };
  }

  private async assertEventMember(academyId: string, eventId: string) {
    const event = await this.prisma.interschoolEvent.findUnique({
      where: { id: eventId },
      include: { invitations: true, lblRegistrations: true },
    });
    if (!event) throw new NotFoundException("Event not found.");
    const isHost = event.hostAcademyId === academyId;
    const isAcceptedInvitee = event.invitations.some((i) => i.invitedAcademyId === academyId && i.status === "accepted");
    // LBL: a paid sport registration makes the school an event member too
    // (they self-registered instead of being invited).
    const isLblRegistrant = event.lblRegistrations.some((r) => r.academyId === academyId && r.status === "paid");
    if (!isHost && !isAcceptedInvitee && !isLblRegistrant) {
      throw new ForbiddenException("Your academy is not part of this event.");
    }
    return { event, isHost };
  }

  async findOneOrThrow(academyId: string, eventId: string) {
    // Members (host/invitee) can always view. Published events from network
    // academies are also readable, so "discover" listings can be opened.
    try {
      await this.assertEventMember(academyId, eventId);
    } catch (e) {
      if (!(e instanceof ForbiddenException)) throw e;
      const event = await this.prisma.interschoolEvent.findUniqueOrThrow({
        where: { id: eventId },
        include: { hostAcademy: { select: { networkOptIn: true } } },
      });
      const isOpenListing = event.maxTeams != null || event.hostAcademy.networkOptIn;
      const isPublicNetworkEvent = isOpenListing && (event.status === "scheduled" || event.status === "live");
      if (!isPublicNetworkEvent) throw e;
    }
    return this.prisma.interschoolEvent.findUnique({
      where: { id: eventId },
      include: {
        hostAcademy: { select: { id: true, name: true } },
        invitations: { include: { invitedAcademy: { select: { id: true, name: true } } } },
        fixtures: { orderBy: { scheduledAt: "asc" } },
        _count: { select: { rosters: true } },
      },
    });
  }

  createEvent(academyId: string, dto: CreateEventDto) {
    return this.prisma.interschoolEvent.create({
      data: {
        hostAcademyId: academyId,
        name: dto.name,
        sports: dto.sports,
        formatType: dto.formatType,
        ageBands: dto.ageBands,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        entryRules: dto.entryRules as object,
        payToJoin: dto.payToJoin ?? false,
        pricePerHead: dto.pricePerHead,
        isLbl: dto.isLbl ?? false,
        maxTeams: dto.maxTeams,
        venue: dto.venue,
        groupCount: dto.groupCount ?? 1,
        playoffMode: dto.playoffMode ?? "none",
        status: "draft",
      },
    });
  }

  // ── Match Center: join, chat, fixtures, standings (2026-07) ──────────────

  // A discovered event can be joined directly (no invitation needed) while
  // slots remain — the host counts as one team against maxTeams.
  async joinEvent(academyId: string, eventId: string) {
    const event = await this.prisma.interschoolEvent.findUnique({
      where: { id: eventId },
      include: { invitations: true },
    });
    if (!event) throw new NotFoundException("Event not found.");
    if (event.hostAcademyId === academyId) throw new BadRequestException("You are hosting this event.");
    if (event.status !== "scheduled") throw new BadRequestException("This event is not open for joining.");

    const existing = event.invitations.find((i) => i.invitedAcademyId === academyId);
    if (existing?.status === "accepted") {
      return { joined: true, alreadyJoined: true, teamsJoined: this.teamCount(event.invitations), maxTeams: event.maxTeams };
    }
    const teams = this.teamCount(event.invitations);
    if (event.maxTeams != null && teams >= event.maxTeams) {
      throw new BadRequestException(`Event is full — all ${event.maxTeams} team slots are taken.`);
    }

    await this.prisma.eventInvitation.upsert({
      where: { eventId_invitedAcademyId: { eventId, invitedAcademyId: academyId } },
      update: { status: "accepted" },
      create: { eventId, invitedAcademyId: academyId, status: "accepted" },
    });
    const teamsJoined = teams + 1;
    // Last slot filled → try building the fixtures right away (skips any
    // sport whose rosters aren't in yet; retried after each nomination).
    let autoFixtures = null;
    if (event.maxTeams != null && teamsJoined >= event.maxTeams) {
      autoFixtures = await this.generateEventFixtures(eventId).catch(() => null);
    }
    return { joined: true, teamsJoined, maxTeams: event.maxTeams, autoFixtures };
  }

  // Host + every accepted school = one team each.
  private teamCount(invitations: { status: string }[]) {
    return 1 + invitations.filter((i) => i.status === "accepted").length;
  }

  // Host-triggered fixture generation for Match Center events (the "generate
  // fixtures" button) — the auto path calls the internal builder directly.
  async generateFixtures(academyId: string, eventId: string) {
    const { event, isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can generate fixtures.");
    if (event.isLbl) return this.generateLblFixtures(academyId, eventId);
    return this.generateEventFixtures(eventId);
  }

  // Round robin per sport among the host + joined schools. A sport is only
  // built once every participating school has nominated a roster for it —
  // until then it's reported in `skipped` with the reason.
  private async generateEventFixtures(eventId: string) {
    const event = await this.prisma.interschoolEvent.findUnique({
      where: { id: eventId },
      include: { invitations: { where: { status: "accepted" } } },
    });
    if (!event) throw new NotFoundException("Event not found.");

    const participantIds = [event.hostAcademyId, ...event.invitations.map((i) => i.invitedAcademyId)];
    const created: string[] = [];
    const skipped: { sportKey: string; reason: string }[] = [];

    for (const sportKey of event.sports) {
      const existing = await this.prisma.fixture.count({ where: { eventId, sportKey } });
      if (existing > 0) {
        skipped.push({ sportKey, reason: "fixtures already generated" });
        continue;
      }
      if (participantIds.length < 2) {
        skipped.push({ sportKey, reason: "needs at least 2 teams" });
        continue;
      }
      const rosters = new Map<string, string[]>();
      for (const aId of participantIds) {
        const entries = await this.prisma.eventRoster.findMany({ where: { eventId, sportKey, academyId: aId } });
        rosters.set(aId, entries.map((e) => e.clientId));
      }
      const missing = participantIds.filter((aId) => (rosters.get(aId) ?? []).length === 0);
      if (missing.length > 0) {
        skipped.push({ sportKey, reason: `waiting for rosters from ${missing.length} team(s)` });
        continue;
      }
      // Split into the host-configured groups (snake by join order) and run
      // a round robin inside each; groupNo tags feed the per-group tables
      // the playoff pairings read later.
      const groupCount = Math.max(1, event.groupCount ?? 1);
      const usableGroups = participantIds.length >= groupCount * 2 ? groupCount : 1;
      const groups: string[][] = Array.from({ length: usableGroups }, () => []);
      participantIds.forEach((aId, i) => {
        const row = Math.floor(i / usableGroups);
        const col = i % usableGroups;
        groups[row % 2 === 0 ? col : usableGroups - 1 - col].push(aId);
      });
      for (let g = 0; g < usableGroups; g++) {
        const members = groups[g];
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const fixture = await this.prisma.fixture.create({
              data: {
                eventId,
                sportKey,
                formatType: event.formatType,
                entrantA: rosters.get(members[i]) ?? [],
                entrantB: rosters.get(members[j]) ?? [],
                matchType: "interschool",
                status: "scheduled",
                scheduledAt: event.startDate,
                // Fixtures inherit the event's venue (the host's center).
                venue: event.venue,
                stage: "group",
                groupNo: usableGroups > 1 ? g + 1 : null,
              },
            });
            created.push(fixture.id);
          }
        }
      }
    }
    return { created: created.length, skipped };
  }

  // ── Playoffs after the Match Center league stage (2026-07) ────────────────
  // The host configured groups + playoffMode when listing the event; once a
  // sport's league fixtures are all completed, the host confirms each playoff
  // round here. Match Center fixtures have no winner-advance chain, so this
  // is iterative: first call builds the opening round (Final / Semifinals /
  // Quarterfinals per the config), later calls pair the winners of the last
  // completed round until the Final is played.
  async generatePlayoffs(academyId: string, eventId: string) {
    const { event, isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can generate playoff rounds.");
    if (event.playoffMode === "none") {
      throw new BadRequestException("This event was listed as league-only — the points table decides it.");
    }

    const [fixtures, rosterRows] = await Promise.all([
      this.prisma.fixture.findMany({ where: { eventId } }),
      this.prisma.eventRoster.findMany({ where: { eventId } }),
    ]);
    const academyOf = new Map(rosterRows.map((r) => [r.clientId, r.academyId]));
    const rosterOf = new Map<string, Map<string, string[]>>(); // sportKey -> academyId -> clientIds
    for (const r of rosterRows) {
      if (!rosterOf.has(r.sportKey)) rosterOf.set(r.sportKey, new Map());
      const bySport = rosterOf.get(r.sportKey)!;
      bySport.set(r.academyId, [...(bySport.get(r.academyId) ?? []), r.clientId]);
    }
    const winnerAcademy = (f: (typeof fixtures)[number]): string | null => {
      const summary = f.resultSummary as { winnerSide?: "A" | "B" | "draw" } | null;
      if (!summary?.winnerSide || summary.winnerSide === "draw") return null;
      const side = summary.winnerSide === "A" ? f.entrantA : f.entrantB;
      return academyOf.get(side[0] ?? "") ?? null;
    };

    const LABEL: Record<number, string> = { 1: "Final", 2: "Semifinal", 4: "Quarterfinal" };
    const created: { sportKey: string; round: string; matches: number }[] = [];
    const skipped: { sportKey: string; reason: string }[] = [];

    for (const sportKey of event.sports) {
      const sportFixtures = fixtures.filter((f) => f.sportKey === sportKey);
      const groupFixtures = sportFixtures.filter((f) => f.stage === "group");
      if (groupFixtures.length === 0) {
        skipped.push({ sportKey, reason: "league fixtures not generated yet" });
        continue;
      }
      if (groupFixtures.some((f) => f.status !== "completed")) {
        skipped.push({ sportKey, reason: "league stage still in progress" });
        continue;
      }

      const playoff = sportFixtures
        .filter((f) => f.stage === "playoff")
        .sort((a, b) => (a.roundLabel === b.roundLabel ? 0 : a.roundLabel === "Final" ? 1 : -1));
      const lastRoundLabel = playoff.length
        ? (playoff.find((f) => f.roundLabel === "Final") ? "Final" : playoff.find((f) => f.roundLabel === "Semifinal") ? "Semifinal" : "Quarterfinal")
        : null;

      let pairs: [string, string][] = []; // [academyA, academyB]
      let label: string;

      if (!lastRoundLabel) {
        // Opening playoff round from the per-group league tables.
        const totalQualifiers = event.playoffMode === "final" ? 2 : event.playoffMode === "semis" ? 4 : 8;
        const groupNos = [...new Set(groupFixtures.map((f) => f.groupNo ?? 1))].sort((a, b) => a - b);
        const perGroup = totalQualifiers / groupNos.length;
        if (!Number.isInteger(perGroup) || perGroup < 1) {
          skipped.push({ sportKey, reason: `${event.playoffMode} playoffs don't divide across ${groupNos.length} groups` });
          continue;
        }
        // Per-group table: 2 points a win, 1 a draw (same as the standings).
        const tables = new Map<number, Map<string, { pts: number; won: number }>>();
        for (const f of groupFixtures) {
          const g = f.groupNo ?? 1;
          if (!tables.has(g)) tables.set(g, new Map());
          const table = tables.get(g)!;
          const aAc = academyOf.get(f.entrantA[0] ?? "");
          const bAc = academyOf.get(f.entrantB[0] ?? "");
          if (!aAc || !bAc) continue;
          const row = (id: string) => table.get(id) ?? table.set(id, { pts: 0, won: 0 }).get(id)!;
          const summary = f.resultSummary as { winnerSide?: "A" | "B" | "draw" } | null;
          const a = row(aAc);
          const b = row(bAc);
          if (summary?.winnerSide === "draw") {
            a.pts++; b.pts++;
          } else if (summary?.winnerSide === "A") {
            a.pts += 2; a.won++;
          } else if (summary?.winnerSide === "B") {
            b.pts += 2; b.won++;
          }
        }
        const ranked: string[][] = groupNos.map((g) =>
          [...(tables.get(g) ?? new Map()).entries()].sort((x, y) => y[1].pts - x[1].pts || y[1].won - x[1].won).map(([id]) => id)
        );
        if (ranked.some((r) => r.length < perGroup)) {
          skipped.push({ sportKey, reason: "a group has fewer teams than qualifiers needed" });
          continue;
        }
        const G = (g: number, r: number) => ranked[g][r];
        if (ranked.length === 1) {
          const seedPairs: Record<number, [number, number][]> = { 2: [[0, 1]], 4: [[0, 3], [1, 2]], 8: [[0, 7], [3, 4], [2, 5], [1, 6]] };
          pairs = seedPairs[totalQualifiers].map(([a, b]) => [G(0, a), G(0, b)]);
        } else if (ranked.length === 2) {
          if (totalQualifiers === 2) pairs = [[G(0, 0), G(1, 0)]];
          else if (totalQualifiers === 4) pairs = [[G(0, 0), G(1, 1)], [G(1, 0), G(0, 1)]];
          else pairs = [[G(0, 0), G(1, 3)], [G(0, 2), G(1, 1)], [G(1, 0), G(0, 3)], [G(1, 2), G(0, 1)]];
        } else {
          if (totalQualifiers === 4) pairs = [[G(0, 0), G(2, 0)], [G(1, 0), G(3, 0)]];
          else pairs = [[G(0, 0), G(1, 1)], [G(2, 0), G(3, 1)], [G(1, 0), G(0, 1)], [G(3, 0), G(2, 1)]];
        }
        label = LABEL[pairs.length];
      } else {
        // Pair the winners of the last playoff round.
        if (lastRoundLabel === "Final") {
          skipped.push({ sportKey, reason: "the Final has already been generated" });
          continue;
        }
        const lastRound = playoff.filter((f) => f.roundLabel === lastRoundLabel);
        if (lastRound.some((f) => f.status !== "completed")) {
          skipped.push({ sportKey, reason: `${lastRoundLabel} round still in progress` });
          continue;
        }
        const winners = lastRound.map(winnerAcademy);
        if (winners.some((w) => !w)) {
          skipped.push({ sportKey, reason: "a playoff match ended in a draw — replay or decide it first" });
          continue;
        }
        for (let i = 0; i < winners.length; i += 2) pairs.push([winners[i]!, winners[i + 1]!]);
        label = LABEL[pairs.length];
      }

      for (const [aAc, bAc] of pairs) {
        await this.prisma.fixture.create({
          data: {
            eventId,
            sportKey,
            formatType: event.formatType,
            entrantA: rosterOf.get(sportKey)?.get(aAc) ?? [],
            entrantB: rosterOf.get(sportKey)?.get(bAc) ?? [],
            matchType: "interschool",
            status: "scheduled",
            scheduledAt: event.startDate,
            venue: event.venue,
            stage: "playoff",
            roundLabel: label,
          },
        });
      }
      created.push({ sportKey, round: label, matches: pairs.length });
    }
    return { created, skipped };
  }

  // Team chat: host + joined schools message each other; the thread locks
  // once the event closes (matches over).
  async listMessages(academyId: string, eventId: string) {
    await this.assertEventMember(academyId, eventId);
    return this.prisma.eventMessage.findMany({
      where: { eventId },
      include: { academy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async postMessage(academyId: string, userId: string, eventId: string, body: string) {
    const { event } = await this.assertEventMember(academyId, eventId);
    if (event.status === "closed") {
      throw new BadRequestException("This event has ended — the team chat is closed.");
    }
    const text = (body ?? "").trim();
    if (!text) throw new BadRequestException("Message cannot be empty.");
    if (text.length > 1000) throw new BadRequestException("Message is too long (1000 characters max).");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return this.prisma.eventMessage.create({
      data: { eventId, academyId, userId, senderName: user?.name ?? "Coach", body: text },
      include: { academy: { select: { id: true, name: true } } },
    });
  }

  // Per-event points table from completed fixtures, per sport. Sides map back
  // to schools through the event rosters. Open to every academy role — this
  // is what parents see in their Match Center view.
  async eventStandings(eventId: string) {
    const event = await this.prisma.interschoolEvent.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, sports: true, status: true },
    });
    if (!event) throw new NotFoundException("Event not found.");
    const [fixtures, rosters] = await Promise.all([
      // The points table is the LEAGUE table — playoff results show on the
      // fixtures list with their round labels, not in the standings.
      this.prisma.fixture.findMany({ where: { eventId, status: "completed", stage: "group" } }),
      this.prisma.eventRoster.findMany({ where: { eventId }, select: { clientId: true, academyId: true } }),
    ]);
    const academyOf = new Map(rosters.map((r) => [r.clientId, r.academyId]));
    const academyIds = [...new Set(rosters.map((r) => r.academyId))];
    const academies = await this.prisma.academy.findMany({
      where: { id: { in: academyIds } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(academies.map((a) => [a.id, a.name]));

    type Row = { academyId: string; name: string; played: number; won: number; lost: number; drawn: number; points: number };
    const tables = new Map<string, Map<string, Row>>();
    for (const f of fixtures) {
      const summary = f.resultSummary as { winnerSide?: "A" | "B" | "draw" } | null;
      if (!summary?.winnerSide) continue;
      const aAcademy = academyOf.get(f.entrantA[0] ?? "");
      const bAcademy = academyOf.get(f.entrantB[0] ?? "");
      if (!aAcademy || !bAcademy) continue;
      if (!tables.has(f.sportKey)) tables.set(f.sportKey, new Map());
      const table = tables.get(f.sportKey)!;
      const rowFor = (id: string): Row => {
        if (!table.has(id)) {
          table.set(id, { academyId: id, name: nameOf.get(id) ?? "School", played: 0, won: 0, lost: 0, drawn: 0, points: 0 });
        }
        return table.get(id)!;
      };
      const a = rowFor(aAcademy);
      const b = rowFor(bAcademy);
      a.played++;
      b.played++;
      if (summary.winnerSide === "draw") {
        a.drawn++; b.drawn++; a.points++; b.points++;
      } else {
        const winner = summary.winnerSide === "A" ? a : b;
        const loser = summary.winnerSide === "A" ? b : a;
        winner.won++;
        winner.points += 2;
        loser.lost++;
      }
    }
    return {
      eventId: event.id,
      eventName: event.name,
      status: event.status,
      standings: [...tables.entries()].map(([sportKey, table]) => ({
        sportKey,
        rows: [...table.values()].sort((x, y) => y.points - x.points || y.won - x.won),
      })),
    };
  }

  // ── LBL Tournaments (2026-07) ────────────────────────────────────────────
  // Open tournaments schools self-register for (per sport, with payment),
  // instead of the invitation flow.

  findLblEvents(academyId: string) {
    return this.prisma.interschoolEvent.findMany({
      where: {
        isLbl: true,
        OR: [
          { hostAcademyId: academyId },
          { status: { in: ["scheduled", "live"] }, hostAcademy: { networkOptIn: true } },
        ],
      },
      include: {
        hostAcademy: { select: { id: true, name: true } },
        lblRegistrations: { where: { academyId } },
        _count: { select: { fixtures: true, lblRegistrations: true } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  private async findLblEventOrThrow(eventId: string) {
    const event = await this.prisma.interschoolEvent.findUnique({ where: { id: eventId } });
    if (!event || !event.isLbl) throw new NotFoundException("LBL tournament not found.");
    return event;
  }

  // Registers the coach's school for one or more of the tournament's sports.
  // Free tournaments register as paid immediately; pay-to-join ones await
  // the (mock-gateway) payment step per sport.
  async registerLbl(academyId: string, eventId: string, sports: string[], userId: string) {
    const event = await this.findLblEventOrThrow(eventId);
    if (event.hostAcademyId === academyId) {
      throw new BadRequestException("The host school is automatically part of its own tournament.");
    }
    const valid = sports.filter((s) => event.sports.includes(s));
    if (valid.length === 0) throw new BadRequestException("Pick at least one sport this tournament offers.");

    const results = [];
    for (const sportKey of valid) {
      results.push(
        await this.prisma.lblRegistration.upsert({
          where: { eventId_academyId_sportKey: { eventId, academyId, sportKey } },
          update: {},
          create: {
            eventId,
            academyId,
            sportKey,
            registeredBy: userId,
            amount: event.payToJoin ? event.pricePerHead : null,
            status: event.payToJoin ? "pending_payment" : "paid",
            paidAt: event.payToJoin ? null : new Date(),
          },
        })
      );
    }
    return results;
  }

  // Mock payment gateway — marks the sport registration paid. Swap for the
  // real Razorpay flow when payments go live.
  async payLblRegistration(academyId: string, eventId: string, sportKey: string) {
    await this.findLblEventOrThrow(eventId);
    const reg = await this.prisma.lblRegistration.findUnique({
      where: { eventId_academyId_sportKey: { eventId, academyId, sportKey } },
    });
    if (!reg) throw new NotFoundException("Register for this sport first.");
    if (reg.status === "paid") return reg;
    return this.prisma.lblRegistration.update({
      where: { id: reg.id },
      data: { status: "paid", paidAt: new Date() },
    });
  }

  async lblRegistrations(academyId: string, eventId: string) {
    const event = await this.findLblEventOrThrow(eventId);
    const isHost = event.hostAcademyId === academyId;
    const mineOnly = isHost ? {} : { academyId };
    return this.prisma.lblRegistration.findMany({
      where: { eventId, ...mineOnly },
      include: { academy: { select: { id: true, name: true } } },
      orderBy: [{ sportKey: "asc" }, { createdAt: "asc" }],
    });
  }

  // Host generates round-robin fixtures per sport once teams are registered,
  // paid, and rostered. Idempotent per sport (skips sports that already have
  // fixtures) and reports exactly why a sport was skipped.
  async generateLblFixtures(academyId: string, eventId: string) {
    const event = await this.findLblEventOrThrow(eventId);
    if (event.hostAcademyId !== academyId) {
      throw new ForbiddenException("Only the host school can generate fixtures.");
    }

    const created: string[] = [];
    const skipped: { sportKey: string; reason: string }[] = [];

    for (const sportKey of event.sports) {
      const existing = await this.prisma.fixture.count({ where: { eventId, sportKey } });
      if (existing > 0) {
        skipped.push({ sportKey, reason: "fixtures already generated" });
        continue;
      }

      const regs = await this.prisma.lblRegistration.findMany({
        where: { eventId, sportKey, status: "paid" },
        include: { academy: { select: { name: true } } },
      });
      // The host plays its own tournament without registering.
      const academies = [
        { academyId: event.hostAcademyId, name: "host" },
        ...regs.map((r) => ({ academyId: r.academyId, name: r.academy.name })),
      ];
      if (academies.length < 2) {
        skipped.push({ sportKey, reason: "needs at least 2 paid schools" });
        continue;
      }

      const rosters = new Map<string, string[]>();
      for (const a of academies) {
        const entries = await this.prisma.eventRoster.findMany({
          where: { eventId, sportKey, academyId: a.academyId },
        });
        rosters.set(a.academyId, entries.map((e) => e.clientId));
      }
      const missing = academies.filter((a) => (rosters.get(a.academyId) ?? []).length === 0);
      if (missing.length > 0) {
        skipped.push({
          sportKey,
          reason: `waiting for rosters from ${missing.length} school(s)`,
        });
        continue;
      }

      // Round-robin: every pair of schools meets once.
      for (let i = 0; i < academies.length; i++) {
        for (let j = i + 1; j < academies.length; j++) {
          const fixture = await this.prisma.fixture.create({
            data: {
              eventId,
              sportKey,
              formatType: event.formatType,
              entrantA: rosters.get(academies[i].academyId) ?? [],
              entrantB: rosters.get(academies[j].academyId) ?? [],
              matchType: "interschool",
              status: "scheduled",
              scheduledAt: event.startDate,
            },
          });
          created.push(fixture.id);
        }
      }
    }
    return { created: created.length, skipped };
  }

  async updateEvent(academyId: string, eventId: string, dto: UpdateEventDto) {
    const { isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can edit this event.");
    const { startDate, endDate, entryRules, settings, ...rest } = dto;
    return this.prisma.interschoolEvent.update({
      where: { id: eventId },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(entryRules ? { entryRules: entryRules as object } : {}),
        ...(settings ? { settings: settings as object } : {}),
      },
    });
  }

  async publishEvent(academyId: string, eventId: string) {
    const { event, isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can publish this event.");
    if (event.status !== "draft") throw new BadRequestException("Only a draft event can be published.");
    return this.prisma.interschoolEvent.update({ where: { id: eventId }, data: { status: "scheduled" } });
  }

  async closeEvent(academyId: string, eventId: string) {
    const { isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can close this event.");
    const fixtures = await this.prisma.fixture.findMany({ where: { eventId } });
    const allSettled = fixtures.every((f) => f.status === "completed" || f.status === "abandoned");
    if (!allSettled) throw new BadRequestException("All fixtures must be completed or abandoned before closing the event.");
    return this.prisma.interschoolEvent.update({ where: { id: eventId }, data: { status: "closed" } });
  }

  async inviteSchools(academyId: string, eventId: string, dto: InviteSchoolsDto) {
    const { event, isHost } = await this.assertEventMember(academyId, eventId);
    if (!isHost) throw new ForbiddenException("Only the host academy can invite schools.");
    const targets = await this.prisma.academy.findMany({
      where: { id: { in: dto.academyIds, not: event.hostAcademyId }, networkOptIn: true },
    });
    if (targets.length !== dto.academyIds.length) {
      throw new BadRequestException("One or more invited academies are not opted into the Interschool Network.");
    }
    await this.prisma.eventInvitation.createMany({
      data: dto.academyIds.map((invitedAcademyId) => ({
        eventId,
        invitedAcademyId,
        responseDeadline: dto.responseDeadline ? new Date(dto.responseDeadline) : undefined,
      })),
      skipDuplicates: true,
    });
    return this.prisma.eventInvitation.findMany({ where: { eventId }, include: { invitedAcademy: { select: { id: true, name: true } } } });
  }

  myInvitations(academyId: string) {
    return this.prisma.eventInvitation.findMany({
      where: { invitedAcademyId: academyId },
      include: { event: { include: { hostAcademy: { select: { id: true, name: true } } } } },
      orderBy: { responseDeadline: "asc" },
    });
  }

  async respondInvitation(academyId: string, invitationId: string, dto: RespondInvitationDto) {
    const invitation = await this.prisma.eventInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new NotFoundException("Invitation not found.");
    if (invitation.invitedAcademyId !== academyId) throw new ForbiddenException();
    return this.prisma.eventInvitation.update({ where: { id: invitationId }, data: { status: dto.status } });
  }

  async listRosters(academyId: string, eventId: string) {
    const { isHost } = await this.assertEventMember(academyId, eventId);
    return this.prisma.eventRoster.findMany({
      where: { eventId, ...(isHost ? {} : { academyId }) },
      include: {
        client: { select: { id: true, name: true, dob: true } },
        academy: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, amount: true, status: true } },
      },
    });
  }

  async nominateRoster(academyId: string, eventId: string, dto: NominateRosterDto) {
    const { event } = await this.assertEventMember(academyId, eventId);
    if (!event.sports.includes(dto.sportKey)) {
      throw new BadRequestException("This sport is not part of the event.");
    }
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: { enrollments: { where: { status: "active" } } },
    });
    if (!client || client.academyId !== academyId) throw new ForbiddenException("Client not in your academy.");

    // BRD 11.8: cannot appear in a rated fixture until (a) Skill Level exists,
    // (b) parental consent for interschool visibility is ON, (c) within the
    // event's declared age-band. Nomination stores this as an eligibility
    // flag rather than hard-blocking, so the Tournament Director can see and
    // resolve gaps (BRD 11.5 step 3: "system auto-checks eligibility").
    const skillLevel = await this.prisma.clientSkillLevel.findUnique({
      where: { clientId_sportKey: { clientId: dto.clientId, sportKey: dto.sportKey } },
    });
    const hasActivePlan = client.enrollments.length > 0;
    const consentOk = client.interschoolConsent;
    const ageOk =
      !client.dob ||
      event.ageBands.some((band) => {
        const maxAge = ageBandMaxAge(band);
        return maxAge === null || ageAsOf(client.dob!, event.startDate) < maxAge;
      });
    const baseEligible = Boolean(skillLevel) && hasActivePlan && consentOk && ageOk;

    // Addendum v3 Section 3.2 — Pay-to-Join: a roster entry can't become
    // "eligible" until its linked Invoice is paid, on top of the existing
    // BRD 11.8 checks above. An Invoice is created (pending) the first time
    // the player is nominated; on re-nomination the existing invoice/payment
    // state is preserved rather than a duplicate being raised.
    const existing = await this.prisma.eventRoster.findUnique({
      where: { eventId_clientId_sportKey: { eventId, clientId: dto.clientId, sportKey: dto.sportKey } },
    });
    let invoiceId = existing?.invoiceId ?? null;
    let paymentOk = true;
    if (event.payToJoin) {
      if (!invoiceId) {
        const invoice = await this.invoicesService.create(academyId, {
          clientId: dto.clientId,
          amount: Number(event.pricePerHead ?? 0),
        });
        invoiceId = invoice.id;
      }
      const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      paymentOk = invoice.status === "paid";
    }
    const eligible = baseEligible && paymentOk;

    const roster = await this.prisma.eventRoster.upsert({
      where: { eventId_clientId_sportKey: { eventId, clientId: dto.clientId, sportKey: dto.sportKey } },
      create: {
        eventId,
        academyId,
        sportKey: dto.sportKey,
        clientId: dto.clientId,
        eligibilityStatus: eligible ? "eligible" : "ineligible",
        consentConfirmed: consentOk,
        invoiceId,
      },
      update: { eligibilityStatus: eligible ? "eligible" : "ineligible", consentConfirmed: consentOk, invoiceId },
      include: { invoice: true },
    });

    // Match Center: when the event is full (maxTeams reached), each roster
    // nomination re-tries fixture generation — the moment the last team's
    // roster lands, the fixtures appear without the host lifting a finger.
    if (event.maxTeams != null && !event.isLbl) {
      const accepted = await this.prisma.eventInvitation.count({ where: { eventId, status: "accepted" } });
      if (1 + accepted >= event.maxTeams) {
        await this.generateEventFixtures(eventId).catch(() => undefined);
      }
    }
    return roster;
  }

  async removeRosterEntry(academyId: string, eventId: string, rosterId: string) {
    const roster = await this.prisma.eventRoster.findUnique({ where: { id: rosterId } });
    if (!roster || roster.eventId !== eventId) throw new NotFoundException("Roster entry not found.");
    if (roster.academyId !== academyId) throw new ForbiddenException("Only your own academy's nominations can be removed.");
    await this.prisma.eventRoster.delete({ where: { id: rosterId } });
    return { removed: true };
  }

  async eventLeaderboard(academyId: string, eventId: string) {
    await this.assertEventMember(academyId, eventId);
    const rosters = await this.prisma.eventRoster.findMany({ where: { eventId, eligibilityStatus: "eligible" } });
    const bySport = new Map<string, string[]>();
    for (const r of rosters) {
      bySport.set(r.sportKey, [...(bySport.get(r.sportKey) ?? []), r.clientId]);
    }
    const result: Record<string, unknown> = {};
    for (const [sportKey, clientIds] of bySport) {
      const ratings = await this.prisma.rating.findMany({
        where: { sportKey, clientId: { in: clientIds } },
        include: {
          client: { select: { id: true, name: true, academyId: true, academy: { select: { name: true } } } },
        },
        orderBy: { currentRating: "desc" },
      });
      result[sportKey] = ratings.map((r) => ({
        ...r,
        reliabilityPct: reliabilityPct(r.matchesPlayed, r.lastUpdatedAt),
      }));
    }
    return result;
  }
}
