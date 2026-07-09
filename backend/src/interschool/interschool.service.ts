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

  async findEvents(academyId: string, status?: EventStatus, scope?: "mine" | "discover") {
    // "discover" = published (scheduled/live) events hosted by OTHER academies
    // in the interschool network — how coaches find game days around them.
    // Default remains: own-hosted or accepted-invitation events only.
    const where =
      scope === "discover"
        ? {
            hostAcademyId: { not: academyId },
            hostAcademy: { networkOptIn: true },
            status: status ?? { in: ["scheduled", "live"] as EventStatus[] },
          }
        : {
            ...(status ? { status } : {}),
            OR: [
              { hostAcademyId: academyId },
              { invitations: { some: { invitedAcademyId: academyId, status: "accepted" as const } } },
            ],
          };
    return this.prisma.interschoolEvent.findMany({
      where,
      include: { hostAcademy: { select: { id: true, name: true } }, _count: { select: { fixtures: true, invitations: true } } },
      orderBy: { startDate: "desc" },
    });
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
      const isPublicNetworkEvent =
        event.hostAcademy.networkOptIn && (event.status === "scheduled" || event.status === "live");
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
        status: "draft",
      },
    });
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

    return this.prisma.eventRoster.upsert({
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
