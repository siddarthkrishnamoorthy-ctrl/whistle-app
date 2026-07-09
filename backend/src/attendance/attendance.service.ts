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
}
