import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PRICING_TIER_SEEDS } from "./pricing-tiers.seed";
import type { DeclareStrengthDto } from "./dto/declare-strength.dto";

const TRIAL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Statuses that count a client as a currently-billable "active student"
// (Addendum v3 5.4 true-up) — mirrors the set Renewals/Reports treat as
// "still enrolled" rather than the single narrow `active` status.
const BILLABLE_ENROLLMENT_STATUSES = ["active", "due", "overdue", "renewed"] as const;
// Addendum v3 5.3 — annual billing gets an illustrative 15% discount vs.
// paying the same tier monthly for 12 months. Not specified further in the
// doc, so applied uniformly across tiers.
const ANNUAL_DISCOUNT = 0.15;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function periodLengthDays(billingCycle: string): number {
  return billingCycle === "annual" ? 365 : 30;
}

@Injectable()
export class PlatformBillingService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // Idempotent — safe on every boot, same pattern as ScoringService's
  // template seeding. Matched by `name` (no DB unique constraint needed
  // since this only ever runs from server boot, not user input).
  async onModuleInit() {
    for (const t of PRICING_TIER_SEEDS) {
      const existing = await this.prisma.pricingTier.findFirst({ where: { name: t.name } });
      if (!existing) {
        await this.prisma.pricingTier.create({
          data: {
            name: t.name,
            minStudents: t.minStudents,
            maxStudents: t.maxStudents,
            pricePerStudentMonth: t.pricePerStudentMonth,
          },
        });
      }
    }
  }

  listTiers() {
    return this.prisma.pricingTier.findMany({ orderBy: { minStudents: "asc" } });
  }

  private async resolveTier(declaredStrength: number) {
    const tier = await this.prisma.pricingTier.findFirst({
      where: {
        minStudents: { lte: declaredStrength },
        OR: [{ maxStudents: null }, { maxStudents: { gte: declaredStrength } }],
      },
      orderBy: { minStudents: "asc" },
    });
    if (!tier) throw new BadRequestException("No pricing tier covers this student strength.");
    return tier;
  }

  private async countActiveStudents(academyId: string): Promise<number> {
    const clients = await this.prisma.client.findMany({
      where: {
        academyId,
        enrollments: { some: { status: { in: [...BILLABLE_ENROLLMENT_STATUSES] } } },
      },
      select: { id: true },
    });
    return clients.length;
  }

  private estimateMonthlyAmount(billableCount: number, pricePerStudentMonth: Prisma.Decimal | null, billingCycle: string): number {
    if (pricePerStudentMonth === null) return 0; // Enterprise — custom quote, no self-serve number to show.
    const base = billableCount * Number(pricePerStudentMonth);
    return billingCycle === "annual" ? base * (1 - ANNUAL_DISCOUNT) : base;
  }

  // Lazily provisions a subscription for academies that existed before this
  // addendum (same backfill pattern as Grades) — declared strength seeded
  // from the academy's live active-client count so it isn't left at zero.
  private async getOrProvision(academyId: string) {
    const existing = await this.prisma.platformSubscription.findUnique({ where: { academyId }, include: { tier: true } });
    if (existing) return existing;

    const actual = await this.countActiveStudents(academyId);
    const declaredStrength = Math.max(actual, 1);
    const tier = await this.resolveTier(declaredStrength);
    const now = new Date();
    const created = await this.prisma.platformSubscription.create({
      data: {
        academyId,
        declaredStrength,
        pricingTierId: tier.id,
        billingCycle: "monthly",
        status: tier.name === "Enterprise" ? "pending_quote" : "trial",
        trialEndsAt: addDays(now, TRIAL_DAYS),
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, periodLengthDays("monthly")),
      },
      include: { tier: true },
    });
    return created;
  }

  async usage(academyId: string) {
    const subscription = await this.getOrProvision(academyId);
    const actualActiveStudents = await this.countActiveStudents(academyId);
    const billableStudentCount = Math.max(subscription.declaredStrength, actualActiveStudents);
    const estimatedAmount = this.estimateMonthlyAmount(billableStudentCount, subscription.tier.pricePerStudentMonth, subscription.billingCycle);
    const recentInvoices = await this.prisma.platformInvoice.findMany({
      where: { academyId },
      orderBy: { issuedAt: "desc" },
      take: 12,
    });
    return {
      subscription,
      actualActiveStudents,
      billableStudentCount,
      estimatedAmount,
      recentInvoices,
    };
  }

  // POST /platform-subscriptions — self-serve declare-strength → tier → pay
  // → provision (Addendum v3 5.2). Enterprise band has no self-serve price,
  // so it's routed to `pending_quote` instead of `active` — 5.2 step 4,
  // "routed to a Request a quote path" rather than a payment form.
  //
  // There is no real payment gateway wired into this codebase yet (Razorpay/
  // WhatsApp are Settings-tab stubs elsewhere) — self-serve tiers activate
  // immediately in place of a real charge, matching that existing pattern.
  async declareStrength(academyId: string, dto: DeclareStrengthDto) {
    const tier = await this.resolveTier(dto.declaredStrength);
    const now = new Date();
    const isEnterprise = tier.name === "Enterprise";

    const data = {
      declaredStrength: dto.declaredStrength,
      pricingTierId: tier.id,
      billingCycle: dto.billingCycle,
      status: isEnterprise ? "pending_quote" : "active",
      trialEndsAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, periodLengthDays(dto.billingCycle)),
    };

    const subscription = await this.prisma.platformSubscription.upsert({
      where: { academyId },
      create: { academyId, ...data },
      update: data,
      include: { tier: true },
    });
    return subscription;
  }

  // POST /platform-subscriptions/:id/upgrade — change declared strength
  // and/or tier. Applied immediately rather than deferred to next cycle:
  // the addendum doesn't specify proration rules, and immediate effect keeps
  // billableStudentCount (the true-up floor) accurate right away.
  async upgrade(academyId: string, id: string, dto: DeclareStrengthDto) {
    const subscription = await this.prisma.platformSubscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException("Subscription not found.");
    if (subscription.academyId !== academyId) throw new ForbiddenException();

    const tier = await this.resolveTier(dto.declaredStrength);
    const isEnterprise = tier.name === "Enterprise";
    return this.prisma.platformSubscription.update({
      where: { id },
      data: {
        declaredStrength: dto.declaredStrength,
        pricingTierId: tier.id,
        billingCycle: dto.billingCycle,
        status: isEnterprise ? "pending_quote" : subscription.status === "trial" ? "active" : subscription.status,
      },
      include: { tier: true },
    });
  }

  // POST /internal/billing/run-period-close — the addendum specs this as a
  // scheduled job (5.7), but this environment has no cron/queue runner
  // (BullMQ/Redis was deferred earlier in this build for the same reason).
  // Scoped here as an admin-triggerable action for their OWN academy only —
  // there's no "Whistle staff" role anywhere in this schema to gate a
  // cross-academy version safely, and "preview/close my own period now" is
  // enough to demo and test the true-up logic end-to-end.
  async runPeriodClose(academyId: string) {
    const subscription = await this.getOrProvision(academyId);
    if (subscription.status === "pending_quote") {
      throw new BadRequestException("This academy is on the Enterprise quote path — billing is handled manually by the Whistle team.");
    }
    const actualActiveStudents = await this.countActiveStudents(academyId);
    const billableStudentCount = Math.max(subscription.declaredStrength, actualActiveStudents);
    const amount = this.estimateMonthlyAmount(billableStudentCount, subscription.tier.pricePerStudentMonth, subscription.billingCycle);

    const [invoice] = await this.prisma.$transaction([
      this.prisma.platformInvoice.create({
        data: {
          academyId,
          subscriptionId: subscription.id,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          declaredStrengthSnapshot: subscription.declaredStrength,
          actualActiveStudentsSnapshot: actualActiveStudents,
          billableStudentCount,
          amount,
          status: "pending",
        },
      }),
      this.prisma.platformSubscription.update({
        where: { id: subscription.id },
        data: {
          status: subscription.status === "trial" ? "active" : subscription.status,
          currentPeriodStart: subscription.currentPeriodEnd,
          currentPeriodEnd: addDays(subscription.currentPeriodEnd, periodLengthDays(subscription.billingCycle)),
        },
      }),
    ]);
    return invoice;
  }

  async markInvoicePaid(academyId: string, invoiceId: string) {
    const invoice = await this.prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.academyId !== academyId) throw new ForbiddenException();
    return this.prisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: "paid" } });
  }
}
