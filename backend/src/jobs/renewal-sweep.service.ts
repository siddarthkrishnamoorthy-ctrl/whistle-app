import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How many days before an enrollment's end date it flips to "due" and the
// guardian gets nudged (BRD 7.3.7's renewal window).
const DUE_WINDOW_DAYS = 7;

function startOfToday(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

@Injectable()
export class RenewalSweepService {
  private readonly logger = new Logger(RenewalSweepService.name);

  constructor(private prisma: PrismaService) {}

  // Daily renewals sweep: flip enrollments approaching/past their end date to
  // due/overdue, then nudge each linked guardian with an in-app chat message
  // from their academy's admin. (WhatsApp integration is still mocked, so
  // chat is the real delivery channel today.) Only enrollments flipped in
  // this run produce a message, so guardians aren't re-spammed every day.
  async runDailySweep() {
    const today = startOfToday();
    const dueCutoff = new Date(today.getTime() + DUE_WINDOW_DAYS * MS_PER_DAY);

    const enrollmentInclude = {
      client: { select: { id: true, name: true, academyId: true } },
      plan: { select: { title: true } },
    } as const;

    const toDue = await this.prisma.enrollment.findMany({
      where: { status: "active", endDate: { gte: today, lte: dueCutoff } },
      include: enrollmentInclude,
    });
    const toOverdue = await this.prisma.enrollment.findMany({
      where: { status: { in: ["active", "due"] }, endDate: { lt: today } },
      include: enrollmentInclude,
    });

    if (toDue.length) {
      await this.prisma.enrollment.updateMany({
        where: { id: { in: toDue.map((e) => e.id) } },
        data: { status: "due" },
      });
    }
    if (toOverdue.length) {
      await this.prisma.enrollment.updateMany({
        where: { id: { in: toOverdue.map((e) => e.id) } },
        data: { status: "overdue" },
      });
    }

    let remindersSent = 0;
    for (const e of toDue) {
      remindersSent += await this.remindGuardians(
        e.client.academyId,
        e.client.id,
        `Renewal reminder: ${e.client.name}'s "${e.plan.title}" plan ends on ${e.endDate.toISOString().slice(0, 10)}. Please renew to keep their sessions going.`
      );
    }
    for (const e of toOverdue) {
      remindersSent += await this.remindGuardians(
        e.client.academyId,
        e.client.id,
        `Renewal overdue: ${e.client.name}'s "${e.plan.title}" plan ended on ${e.endDate.toISOString().slice(0, 10)}. Please renew to resume their sessions.`
      );
    }

    const summary = { flippedDue: toDue.length, flippedOverdue: toOverdue.length, remindersSent };
    this.logger.log(`Renewal sweep: ${JSON.stringify(summary)}`);
    return summary;
  }

  // Sends `body` to every guardian of the client as a direct chat message
  // from the academy's admin, reusing an existing direct thread when one
  // exists. Returns the number of messages sent.
  private async remindGuardians(academyId: string, clientId: string, body: string): Promise<number> {
    const admin = await this.prisma.user.findFirst({ where: { academyId, role: "admin" } });
    if (!admin) return 0;

    const guardians = await this.prisma.clientGuardian.findMany({ where: { clientId }, select: { userId: true } });
    let sent = 0;
    for (const g of guardians) {
      if (g.userId === admin.id) continue;
      let thread = await this.prisma.chatThread.findFirst({
        where: {
          academyId,
          type: "direct",
          AND: [{ members: { some: { userId: admin.id } } }, { members: { some: { userId: g.userId } } }],
        },
      });
      thread ??= await this.prisma.chatThread.create({
        data: {
          academyId,
          type: "direct",
          members: { create: [{ userId: admin.id }, { userId: g.userId }] },
        },
      });
      await this.prisma.chatMessage.create({ data: { threadId: thread.id, senderId: admin.id, body } });
      sent++;
    }
    return sent;
  }
}
