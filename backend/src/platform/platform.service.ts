import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformBillingService } from "../platform-billing/platform-billing.service";
import { DEFAULT_GRADES } from "../auth/auth.service";

const PASSWORD_SALT_ROUNDS = 10;
const TRIAL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whistle — the platform company — operating its own product (2026-07).
// The operator sells the platform to schools and academies per student,
// so this service is deliberately cross-tenant: it is only ever reached
// through platform_owner-gated routes.
@Injectable()
export class PlatformService implements OnModuleInit {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private prisma: PrismaService,
    private billing: PlatformBillingService
  ) {}

  // Seed the operator account — there is no signup path for Whistle itself.
  // Idempotent, same boot-seeding pattern as pricing tiers and sports.
  async onModuleInit() {
    const email = "owner@whistle.app";
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.user.create({
        data: {
          academyId: null,
          name: "Whistle Platform",
          email,
          passwordHash: await bcrypt.hash("whistle123", PASSWORD_SALT_ROUNDS),
          role: "platform_owner",
        },
      });
      this.logger.log("Seeded platform owner account (owner@whistle.app).");
    }
    await this.seedContentLibrary();
  }

  // ── Tenants ────────────────────────────────────────────────────────────────

  async listTenants() {
    const academies = await this.prisma.academy.findMany({
      include: {
        _count: { select: { clients: true, users: true, schools: true, centers: true } },
        platformSubscription: { include: { tier: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const revenue = await this.prisma.platformInvoice.groupBy({
      by: ["academyId", "status"],
      _sum: { amount: true },
    });
    return academies.map((a) => {
      const collected = revenue
        .filter((r) => r.academyId === a.id && r.status === "paid")
        .reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
      const outstanding = revenue
        .filter((r) => r.academyId === a.id && r.status === "pending")
        .reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
      return {
        id: a.id,
        name: a.name,
        contactEmail: a.contactEmail,
        createdAt: a.createdAt,
        suspended: a.suspended,
        studentAllowance: a.studentAllowance,
        allowanceMode: a.allowanceMode,
        allowedSports: a.allowedSports,
        brandTheme: a.brandTheme,
        counts: a._count,
        subscription: a.platformSubscription
          ? {
              id: a.platformSubscription.id,
              status: a.platformSubscription.status,
              declaredStrength: a.platformSubscription.declaredStrength,
              billingCycle: a.platformSubscription.billingCycle,
              tier: a.platformSubscription.tier?.name ?? null,
              pricePerStudentMonth: a.platformSubscription.tier?.pricePerStudentMonth ?? null,
              currentPeriodEnd: a.platformSubscription.currentPeriodEnd,
            }
          : null,
        revenue: { collected, outstanding },
      };
    });
  }

  // Operator dials: student allowance + hard/true-up mode + suspension +
  // sport access grant + display branding (name/font/logo).
  async updateTenant(
    id: string,
    dto: {
      name?: string;
      studentAllowance?: number | null;
      allowanceMode?: string;
      suspended?: boolean;
      allowedSports?: string[];
      brandTheme?: { displayName?: string; fontKey?: string; logoUrl?: string } | null;
    }
  ) {
    const academy = await this.prisma.academy.findUnique({ where: { id } });
    if (!academy) throw new NotFoundException("Tenant not found.");
    if (dto.allowanceMode && !["hard", "true_up"].includes(dto.allowanceMode)) {
      throw new BadRequestException('allowanceMode must be "hard" or "true_up".');
    }
    if (dto.allowedSports !== undefined && !Array.isArray(dto.allowedSports)) {
      throw new BadRequestException("allowedSports must be an array of sport keys.");
    }
    // Branding merges (rather than replaces) so setting the font doesn't wipe
    // a logo uploaded earlier; explicit null clears it entirely.
    const mergedBrand =
      dto.brandTheme === null
        ? null
        : dto.brandTheme !== undefined
          ? { ...((academy.brandTheme as object | null) ?? {}), ...dto.brandTheme }
          : undefined;
    return this.prisma.academy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.studentAllowance !== undefined ? { studentAllowance: dto.studentAllowance } : {}),
        ...(dto.allowanceMode !== undefined ? { allowanceMode: dto.allowanceMode } : {}),
        ...(dto.suspended !== undefined ? { suspended: dto.suspended } : {}),
        ...(dto.allowedSports !== undefined ? { allowedSports: dto.allowedSports } : {}),
        ...(mergedBrand !== undefined ? { brandTheme: mergedBrand as object } : {}),
      },
    });
  }

  // Operator-side subscription controls — tier follows declared strength the
  // same way the tenant's own declare-strength flow resolves it.
  async updateSubscription(
    academyId: string,
    dto: { declaredStrength?: number; billingCycle?: string; status?: string }
  ) {
    const subscription = await this.prisma.platformSubscription.findUnique({ where: { academyId } });
    if (!subscription) throw new NotFoundException("This tenant has no Whistle subscription yet.");
    if (dto.status && !["trial", "active", "past_due", "cancelled", "pending_quote"].includes(dto.status)) {
      throw new BadRequestException("Invalid subscription status.");
    }

    let pricingTierId = subscription.pricingTierId;
    if (dto.declaredStrength != null) {
      const tier = await this.prisma.pricingTier.findFirst({
        where: {
          minStudents: { lte: dto.declaredStrength },
          OR: [{ maxStudents: null }, { maxStudents: { gte: dto.declaredStrength } }],
        },
        orderBy: { minStudents: "asc" },
      });
      if (!tier) throw new BadRequestException("No pricing tier covers this student strength.");
      pricingTierId = tier.id;
    }

    return this.prisma.platformSubscription.update({
      where: { id: subscription.id },
      data: {
        ...(dto.declaredStrength != null ? { declaredStrength: dto.declaredStrength, pricingTierId } : {}),
        ...(dto.billingCycle ? { billingCycle: dto.billingCycle } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: { tier: true },
    });
  }

  // Whistle signs a school/academy and hands the keys to THEIR admin —
  // "the admin becomes the school or academy".
  async createTenant(dto: {
    name: string;
    contactEmail?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    declaredStrength?: number;
    studentAllowance?: number;
    allowanceMode?: string;
  }) {
    if (!dto.name?.trim() || !dto.adminName?.trim() || !dto.adminEmail?.trim() || !dto.adminPassword) {
      throw new BadRequestException("Tenant name, admin name, admin email and password are required.");
    }
    if (dto.allowanceMode && !["hard", "true_up"].includes(dto.allowanceMode)) {
      throw new BadRequestException('allowanceMode must be "hard" or "true_up".');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.adminEmail.trim() } });
    if (existing) throw new BadRequestException("A user with the admin email already exists.");

    const passwordHash = await bcrypt.hash(dto.adminPassword, PASSWORD_SALT_ROUNDS);
    const declaredStrength = dto.declaredStrength ?? dto.studentAllowance ?? 1;

    return this.prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({
        data: {
          name: dto.name.trim(),
          contactEmail: dto.contactEmail?.trim() || dto.adminEmail.trim(),
          studentAllowance: dto.studentAllowance ?? null,
          allowanceMode: dto.allowanceMode ?? "true_up",
        },
      });
      await tx.grade.createMany({
        data: DEFAULT_GRADES.map((name, i) => ({ academyId: academy.id, name, sortOrder: i })),
      });

      const tier = await tx.pricingTier.findFirst({
        where: {
          minStudents: { lte: declaredStrength },
          OR: [{ maxStudents: null }, { maxStudents: { gte: declaredStrength } }],
        },
        orderBy: { minStudents: "asc" },
      });
      if (tier) {
        const now = new Date();
        await tx.platformSubscription.create({
          data: {
            academyId: academy.id,
            declaredStrength,
            pricingTierId: tier.id,
            billingCycle: "monthly",
            status: tier.name === "Enterprise" ? "pending_quote" : "trial",
            trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * MS_PER_DAY),
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * MS_PER_DAY),
          },
        });
      }

      const admin = await tx.user.create({
        data: {
          academyId: academy.id,
          name: dto.adminName.trim(),
          email: dto.adminEmail.trim(),
          passwordHash,
          role: "admin",
        },
        select: { id: true, name: true, email: true, role: true },
      });

      return { academy, admin };
    });
  }

  // ── Platform revenue ───────────────────────────────────────────────────────

  async revenue() {
    const [tenants, students, schools, invoices, subs] = await Promise.all([
      this.prisma.academy.count(),
      this.prisma.client.count(),
      this.prisma.school.count(),
      this.prisma.platformInvoice.findMany({ orderBy: { issuedAt: "desc" } }),
      this.prisma.platformSubscription.groupBy({ by: ["status"], _count: true }),
    ]);
    const collected = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const outstanding = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0);
    return {
      tenants,
      students,
      schools,
      suspended: await this.prisma.academy.count({ where: { suspended: true } }),
      subscriptionsByStatus: Object.fromEntries(subs.map((s) => [s.status, s._count])),
      invoiced: collected + outstanding,
      collected,
      outstanding,
      recentInvoices: invoices.slice(0, 20),
    };
  }

  async listPlatformInvoices() {
    return this.prisma.platformInvoice.findMany({
      include: { academy: { select: { id: true, name: true } } },
      orderBy: { issuedAt: "desc" },
    });
  }

  // Cross-tenant period close — the scheduled-job stand-in platform-billing
  // couldn't safely expose before a Whistle-staff role existed.
  async closePeriod(academyId: string) {
    const academy = await this.prisma.academy.findUnique({ where: { id: academyId } });
    if (!academy) throw new NotFoundException("Tenant not found.");
    return this.billing.runPeriodClose(academyId);
  }

  async markPlatformInvoicePaid(invoiceId: string) {
    const invoice = await this.prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    return this.billing.markInvoicePaid(invoice.academyId, invoiceId);
  }

  // ── Content library: Whistle's drill bank + lesson plan repository ────────
  // academyId null = platform-owned. Tenants read this library (filtered to
  // their granted sports); only the operator writes to it.

  listPlatformDrills(sportKey?: string) {
    return this.prisma.drill.findMany({
      where: { academyId: null, ...(sportKey ? { sportKey } : {}) },
      include: { sport: true },
      orderBy: [{ sportKey: "asc" }, { title: "asc" }],
    });
  }

  createPlatformDrill(dto: {
    title: string;
    sportKey: string;
    level?: string;
    durationMin?: number;
    description?: string;
    equipment?: string[];
    videoUrl?: string;
  }) {
    if (!dto.title?.trim() || !dto.sportKey) throw new BadRequestException("Title and sport are required.");
    return this.prisma.drill.create({
      data: {
        academyId: null,
        title: dto.title.trim(),
        sportKey: dto.sportKey,
        level: (dto.level as never) ?? undefined,
        durationMin: dto.durationMin,
        description: dto.description,
        equipment: dto.equipment ?? [],
        // Same media shape as tenant-era drills ([{type, url}]) so every
        // existing renderer (admin cards, coach app) reads it unchanged.
        media: dto.videoUrl ? [{ type: "video", url: dto.videoUrl }] : undefined,
      },
      include: { sport: true },
    });
  }

  private async platformDrillOrThrow(id: string) {
    const drill = await this.prisma.drill.findUnique({ where: { id } });
    if (!drill) throw new NotFoundException("Drill not found.");
    if (drill.academyId !== null) throw new BadRequestException("That drill belongs to a tenant's legacy bank, not the platform library.");
    return drill;
  }

  async updatePlatformDrill(
    id: string,
    dto: { title?: string; level?: string; durationMin?: number; description?: string; equipment?: string[]; videoUrl?: string }
  ) {
    const existing = await this.platformDrillOrThrow(id);
    return this.prisma.drill.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.level !== undefined ? { level: dto.level as never } : {}),
        ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.equipment !== undefined ? { equipment: dto.equipment } : {}),
        ...(dto.videoUrl !== undefined
          ? {
              media: [
                ...((existing.media as { type: string; url: string }[] | null) ?? []).filter((m) => m.type !== "video"),
                ...(dto.videoUrl ? [{ type: "video", url: dto.videoUrl }] : []),
              ],
            }
          : {}),
      },
      include: { sport: true },
    });
  }

  async deletePlatformDrill(id: string) {
    await this.platformDrillOrThrow(id);
    await this.prisma.drill.delete({ where: { id } });
    return { ok: true };
  }

  listPlatformLessonPlans(sportKey?: string) {
    return this.prisma.lessonPlan.findMany({
      where: { academyId: null, ...(sportKey ? { sportKey } : {}) },
      include: { sport: true },
      orderBy: [{ sportKey: "asc" }, { title: "asc" }],
    });
  }

  async createPlatformLessonPlan(dto: {
    title: string;
    sportKey: string;
    level?: string;
    goals?: string;
    objectives?: string[];
    targetDurationMin?: number;
    drillIds?: string[];
  }) {
    if (!dto.title?.trim() || !dto.sportKey) throw new BadRequestException("Title and sport are required.");
    const drills = dto.drillIds?.length
      ? await this.prisma.drill.findMany({ where: { id: { in: dto.drillIds }, academyId: null } })
      : [];
    const sessionFlow = drills.map((d, i) => ({
      order: i,
      drillId: d.id,
      drillTitle: d.title,
      durationMin: d.durationMin ?? 10,
    }));
    return this.prisma.lessonPlan.create({
      data: {
        academyId: null,
        title: dto.title.trim(),
        sportKey: dto.sportKey,
        level: dto.level,
        goals: dto.goals,
        objectives: dto.objectives ?? [],
        targetDurationMin: dto.targetDurationMin ?? sessionFlow.reduce((s, f) => s + f.durationMin, 0),
        sessionFlow: sessionFlow as unknown as object,
        whatToBring: [...new Set(drills.flatMap((d) => d.equipment))],
        status: "active",
      },
      include: { sport: true },
    });
  }

  async deletePlatformLessonPlan(id: string) {
    const plan = await this.prisma.lessonPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Lesson plan not found.");
    if (plan.academyId !== null) throw new BadRequestException("That plan belongs to a tenant, not the repository.");
    await this.prisma.lessonPlan.delete({ where: { id } });
    return { ok: true };
  }

  // ── Shared features: platform-wide tournaments + Match Center ─────────────

  listAllTournaments() {
    return this.prisma.tournament.findMany({
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  listAllEvents() {
    return this.prisma.interschoolEvent.findMany({
      include: {
        hostAcademy: { select: { id: true, name: true } },
        _count: { select: { fixtures: true, rosters: true } },
      },
      orderBy: { startDate: "desc" },
      take: 100,
    });
  }

  // ── Boot seed: starter drill + lesson-plan library ─────────────────────────
  // Idempotent — only fires when the platform library is empty, so a fresh
  // install demos the tenant read-only repository straight away.
  private async seedContentLibrary() {
    const existing = await this.prisma.drill.count({ where: { academyId: null } });
    if (existing > 0) return;
    const sports = await this.prisma.sport.findMany({ orderBy: { name: "asc" } });
    for (const sport of sports) {
      const warmup = await this.prisma.drill.create({
        data: {
          academyId: null,
          title: `${sport.name} — Dynamic Warm-up`,
          sportKey: sport.key,
          level: "beginner",
          durationMin: 10,
          description: `Progressive pulse-raiser and mobility routine tailored to ${sport.name.toLowerCase()}: light movement, dynamic stretching, and sport-specific activation patterns.`,
          equipment: ["Cones", "Markers"],
        },
      });
      const core = await this.prisma.drill.create({
        data: {
          academyId: null,
          title: `${sport.name} — Core Skills Circuit`,
          sportKey: sport.key,
          level: "intermediate",
          durationMin: 25,
          description: `Station-based circuit covering the fundamental techniques of ${sport.name.toLowerCase()}, with coach demonstrations and peer feedback rounds.`,
          equipment: ["Cones", "Whistle"],
        },
      });
      await this.prisma.lessonPlan.create({
        data: {
          academyId: null,
          title: `${sport.name} — Foundation Session`,
          sportKey: sport.key,
          level: "beginner",
          goals: `Introduce and consolidate the core movement and technique base for ${sport.name.toLowerCase()}.`,
          objectives: ["Safe warm-up habits", "Fundamental technique", "Small-group game sense"],
          targetDurationMin: 35,
          sessionFlow: [
            { order: 0, drillId: warmup.id, drillTitle: warmup.title, durationMin: 10 },
            { order: 1, drillId: core.id, drillTitle: core.title, durationMin: 25 },
          ] as unknown as object,
          whatToBring: ["Cones", "Markers", "Whistle"],
          status: "active",
        },
      });
    }
    this.logger.log(`Seeded platform content library for ${sports.length} sports.`);
  }
}
