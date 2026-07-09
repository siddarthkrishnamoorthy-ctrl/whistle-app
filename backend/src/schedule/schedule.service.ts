import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SAFE_COACH_INCLUDE } from "../common/prisma-selects";
import { CurriculumService } from "../curriculum/curriculum.service";
import type { GenerateSessionsDto } from "./dto/generate-sessions.dto";
import type { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import type { StartSessionDto } from "./dto/start-session.dto";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Great-circle distance for the venue check-in geofence.
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface ClassTiming {
  days: string[];
  startTime: string;
  endTime: string;
}

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private curriculumService: CurriculumService
  ) {}

  // Single `date` keeps the admin-web day view working; with no date the
  // coach app's Schedule tab gets the upcoming two weeks in one call.
  findForDate(academyId: string, date?: string, centerId?: string) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const horizon = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    return this.prisma.scheduledSession.findMany({
      where: {
        sessionDate: date ? new Date(date) : { gte: today, lte: horizon },
        class: {
          center: { academyId, ...(centerId ? { id: centerId } : {}) },
        },
      },
      include: {
        class: { include: { center: true, coach: SAFE_COACH_INCLUDE } },
        _count: { select: { attendanceRecords: true } },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const session = await this.prisma.scheduledSession.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            center: true,
            coach: SAFE_COACH_INCLUDE,
            enrollments: { where: { status: { in: ["active", "due"] } }, include: { client: true, plan: true } },
          },
        },
        attendanceRecords: true,
      },
    });
    if (!session) throw new NotFoundException("Session not found.");
    if (session.class.center.academyId !== academyId) throw new ForbiddenException();
    return session;
  }

  async generateSessions(academyId: string, dto: GenerateSessionsDto) {
    const klass = await this.prisma.class.findUnique({ where: { id: dto.classId }, include: { center: true } });
    if (!klass) throw new NotFoundException("Class not found.");
    if (klass.center.academyId !== academyId) throw new ForbiddenException();

    const timings = (klass.timings as unknown as ClassTiming[]) ?? [];
    if (timings.length === 0) return { created: 0 };

    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    const rows: { classId: string; sessionDate: Date; startTime: Date; endTime: Date }[] = [];

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const weekday = WEEKDAY_KEYS[d.getDay()];
      for (const timing of timings) {
        if (timing.days.includes(weekday)) {
          rows.push({
            classId: klass.id,
            sessionDate: new Date(d),
            startTime: new Date(`1970-01-01T${timing.startTime}:00Z`),
            endTime: new Date(`1970-01-01T${timing.endTime}:00Z`),
          });
        }
      }
    }

    if (rows.length === 0) return { created: 0 };
    const result = await this.prisma.scheduledSession.createMany({ data: rows });
    return { created: result.count };
  }

  // Coach venue check-in (2026-07): when the class's center has a geofence
  // (geoLat/geoLng), a coach starting the session must send device
  // coordinates inside the fence. Admins/managers can still start remotely
  // (front-desk correction flows). Biometric confirmation and the check-in
  // are recorded on the session either way.
  async start(academyId: string, id: string, actor: { role: string }, checkin?: StartSessionDto) {
    const session = await this.findOneOrThrow(academyId, id);
    const center = session.class?.center;
    const geofenced = center?.geoLat != null && center?.geoLng != null;
    const mustBeOnSite = actor.role === "coach" || actor.role === "head_coach";

    let distanceM: number | null = null;
    if (geofenced && mustBeOnSite) {
      if (checkin?.lat == null || checkin?.lng == null) {
        throw new BadRequestException(
          `${center.name} requires a location check-in — enable location services and try again.`
        );
      }
      distanceM = Math.round(
        haversineMeters(checkin.lat, checkin.lng, Number(center.geoLat), Number(center.geoLng))
      );
      const radius = center.geoRadiusM ?? 500;
      if (distanceM > radius) {
        throw new BadRequestException(
          `You're ~${distanceM}m from ${center.name}. Move within ${radius}m of the venue to start the session.`
        );
      }
    } else if (geofenced && checkin?.lat != null && checkin?.lng != null) {
      distanceM = Math.round(
        haversineMeters(checkin.lat, checkin.lng, Number(center.geoLat), Number(center.geoLng))
      );
    }

    return this.prisma.scheduledSession.update({
      where: { id },
      data: {
        status: "ongoing",
        checkinLat: checkin?.lat,
        checkinLng: checkin?.lng,
        checkinDistanceM: distanceM,
        checkinBiometric: checkin?.biometricConfirmed ?? null,
      },
    });
  }

  // Addendum v3 4.6/4.7 — extended to auto-advance the ClassSequenceProgress
  // cursor and record a SessionLessonDelivery, unless run as an explicit
  // one-off (e.g. a revision lesson that shouldn't consume a syllabus slot).
  // No-ops entirely for classes with no Grade/Curriculum Track — existing
  // sports-academy behaviour is unchanged.
  async complete(academyId: string, id: string, oneOff = false) {
    const session = await this.findOneOrThrow(academyId, id);
    const updated = await this.prisma.scheduledSession.update({ where: { id }, data: { status: "completed" } });
    await this.curriculumService.advanceCursorForSession(academyId, id, session.classId, oneOff);
    return updated;
  }

  async markAttendance(academyId: string, id: string, dto: MarkAttendanceDto, markedBy: string) {
    await this.findOneOrThrow(academyId, id);
    await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: { sessionId_clientId: { sessionId: id, clientId: r.clientId } },
          update: { status: r.status, markedBy, markedAt: new Date() },
          create: { sessionId: id, clientId: r.clientId, status: r.status, markedBy },
        })
      )
    );
    return this.prisma.attendanceRecord.findMany({ where: { sessionId: id } });
  }
}
