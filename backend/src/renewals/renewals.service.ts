import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RenewalsService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string, status?: string) {
    return this.prisma.enrollment.findMany({
      where: {
        client: { academyId },
        status: status ? (status as never) : { in: ["due", "overdue", "renewed", "stopped"] },
      },
      include: { client: true, plan: true, class: true },
      orderBy: { endDate: "asc" },
    });
  }

  async renew(academyId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { client: true, plan: true },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found.");
    if (enrollment.client.academyId !== academyId) throw new ForbiddenException();

    const plan = enrollment.plan;
    const newStart = new Date();
    const newEnd = new Date(newStart);
    if (plan.durationUnit === "day") newEnd.setDate(newEnd.getDate() + (plan.durationValue ?? 1));
    else if (plan.durationUnit === "week") newEnd.setDate(newEnd.getDate() + (plan.durationValue ?? 1) * 7);
    else if (plan.durationUnit === "year") newEnd.setFullYear(newEnd.getFullYear() + (plan.durationValue ?? 1));
    else newEnd.setMonth(newEnd.getMonth() + (plan.durationValue ?? 1));

    // Extends in place (BRD 7.3.5/7.3.7): reset session counters, roll the
    // date window forward, flip back to active — not a new Enrollment row.
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        startDate: newStart,
        endDate: newEnd,
        sessionsUsed: 0,
        sessionsLeft: plan.sessionsIncluded,
        status: "active",
      },
    });
  }
}
