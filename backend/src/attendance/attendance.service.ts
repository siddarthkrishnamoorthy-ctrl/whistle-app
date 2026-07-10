import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async summary(academyId: string, date: string, centerId?: string) {
    const sessions = await this.prisma.scheduledSession.findMany({
      where: {
        sessionDate: new Date(date),
        class: { center: { academyId, ...(centerId ? { id: centerId } : {}) } },
      },
      include: { attendanceRecords: true },
    });

    let present = 0;
    let late = 0;
    let absent = 0;
    for (const session of sessions) {
      for (const record of session.attendanceRecords) {
        if (record.status === "present") present++;
        else if (record.status === "late") late++;
        else if (record.status === "absent") absent++;
      }
    }
    const marked = present + late + absent;
    const attendanceRate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

    return {
      sessionsToday: sessions.length,
      markedPresent: present + late,
      absent,
      attendanceRate,
    };
  }

  // Location-verified staff attendance: every session start records where the
  // coach checked in; the app enforces the 100 m fence, this log proves it.
  async staffLog(academyId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sessions = await this.prisma.scheduledSession.findMany({
      where: {
        sessionDate: { gte: since },
        status: { in: ["ongoing", "completed"] },
        class: { center: { academyId } },
      },
      orderBy: { sessionDate: "desc" },
      take: 200,
      include: {
        class: {
          select: {
            title: true,
            center: { select: { name: true, geoLat: true } },
            coach: { select: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      date: s.sessionDate,
      startTime: s.startTime,
      classTitle: s.class?.title ?? "—",
      center: s.class?.center?.name ?? "—",
      centerHasPin: s.class?.center?.geoLat != null,
      user: s.class?.coach?.user ?? null,
      status: s.status,
      distanceM: s.checkinDistanceM,
      withinFence: s.checkinDistanceM != null ? s.checkinDistanceM <= 100 : null,
      biometric: s.checkinBiometric,
    }));
  }
}
