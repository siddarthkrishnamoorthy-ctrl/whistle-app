import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async attendanceSummary(academyId: string, from: string, to: string, centerId?: string) {
    const sessions = await this.prisma.scheduledSession.findMany({
      where: {
        sessionDate: { gte: new Date(from), lte: endOfDay(to) },
        class: { center: { academyId, ...(centerId ? { id: centerId } : {}) } },
      },
      include: { attendanceRecords: true, class: { select: { title: true } } },
      orderBy: { sessionDate: "asc" },
    });

    const rows = sessions.map((s) => {
      const present = s.attendanceRecords.filter((r) => r.status === "present" || r.status === "late").length;
      const absent = s.attendanceRecords.filter((r) => r.status === "absent").length;
      const marked = present + absent;
      return {
        date: s.sessionDate.toISOString().slice(0, 10),
        className: s.class.title,
        present,
        absent,
        attendanceRate: marked > 0 ? Math.round((present / marked) * 100) : 0,
      };
    });
    const totalPresent = rows.reduce((sum, r) => sum + r.present, 0);
    const totalAbsent = rows.reduce((sum, r) => sum + r.absent, 0);
    const marked = totalPresent + totalAbsent;
    return {
      rows,
      totals: {
        sessions: rows.length,
        present: totalPresent,
        absent: totalAbsent,
        attendanceRate: marked > 0 ? Math.round((totalPresent / marked) * 100) : 0,
      },
    };
  }

  async revenue(academyId: string, from: string, to: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { academyId, issuedAt: { gte: new Date(from), lte: endOfDay(to) } },
      include: { client: { select: { name: true } } },
      orderBy: { issuedAt: "asc" },
    });
    const rows = invoices.map((i) => ({
      date: i.issuedAt.toISOString().slice(0, 10),
      invoiceNumber: i.invoiceNumber,
      client: i.client.name,
      amount: Number(i.amount),
      status: i.status,
    }));
    const totalInvoiced = rows.reduce((sum, r) => sum + r.amount, 0);
    const received = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);
    return { rows, totals: { totalInvoiced, received, outstanding: totalInvoiced - received } };
  }

  async performance(academyId: string, from: string, to: string, sportKey?: string, level?: string) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        assessedAt: { gte: new Date(from), lte: endOfDay(to) },
        client: { academyId },
        ...(sportKey || level
          ? { drill: { ...(sportKey ? { sportKey } : {}), ...(level ? { level: level as never } : {}) } }
          : {}),
      },
      include: { client: { select: { name: true } }, drill: { select: { title: true, sportKey: true } } },
      orderBy: { assessedAt: "desc" },
    });
    const rows = assessments.map((a) => ({
      date: a.assessedAt.toISOString().slice(0, 10),
      client: a.client.name,
      drill: a.drill?.title ?? "—",
      sportKey: a.drill?.sportKey ?? null,
      overallRating: a.overallRating ? Number(a.overallRating) : null,
    }));
    const rated = rows.filter((r) => r.overallRating !== null);
    const avgRating = rated.length > 0 ? rated.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / rated.length : 0;
    return { rows, totals: { assessmentsRecorded: rows.length, averageRating: Math.round(avgRating * 10) / 10 } };
  }

  async enquiryConversion(academyId: string, from: string, to: string) {
    const enquiries = await this.prisma.enquiry.findMany({
      where: { academyId, createdAt: { gte: new Date(from), lte: endOfDay(to) } },
      orderBy: { createdAt: "asc" },
    });
    const rows = enquiries.map((e) => ({
      date: e.createdAt.toISOString().slice(0, 10),
      name: e.name,
      status: e.status,
      stage: e.stage,
    }));
    const total = rows.length;
    const converted = rows.filter((r) => r.stage === "closed").length;
    return {
      rows,
      totals: {
        total,
        converted,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      },
    };
  }

  async renewalChurn(academyId: string, from: string, to: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { client: { academyId }, endDate: { gte: new Date(from), lte: endOfDay(to) } },
      include: { client: { select: { name: true } }, plan: { select: { title: true } } },
      orderBy: { endDate: "asc" },
    });
    const rows = enrollments.map((e) => ({
      endDate: e.endDate.toISOString().slice(0, 10),
      client: e.client.name,
      plan: e.plan.title,
      status: e.status,
    }));
    const total = rows.length;
    const renewed = rows.filter((r) => r.status === "renewed").length;
    const stopped = rows.filter((r) => r.status === "stopped").length;
    return {
      rows,
      totals: {
        total,
        renewed,
        stopped,
        churnRate: total > 0 ? Math.round((stopped / total) * 100) : 0,
      },
    };
  }

  // Expenses aren't tracked anywhere in this build yet (no Expense model /
  // module exists) — return an explicit "not implemented" flag rather than
  // fabricating zeros that would look like real (empty) data.
  expense() {
    return { implemented: false, rows: [], totals: null };
  }
}
