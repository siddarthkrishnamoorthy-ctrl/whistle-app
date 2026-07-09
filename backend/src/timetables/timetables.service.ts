import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DAY_NAMES: Record<string, string> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

interface RawRow {
  grade: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  sport: string;
  center: string;
  coach: string;
}

export interface PreviewRow extends RawRow {
  rowIndex: number;
  resolvedGradeId: string | null;
  resolvedSportKey: string | null;
  resolvedCenterId: string | null;
  resolvedCoachId: string | null;
  normalizedDay: string | null;
  unresolvedFields: string[];
  conflict: boolean;
}

// Minimal CSV parser — the addendum's own template has no quoted/escaped
// commas, so a naive split is sufficient and avoids adding a CSV dependency
// for what is, in practice, a simple flat format.
function parseCsv(text: string): RawRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const [grade, section, day, startTime, endTime, sport, center, coach] = cols;
    if (!grade || !day || !startTime || !endTime || !sport) continue;
    rows.push({ grade, section: section ?? "", day, startTime, endTime, sport, center: center ?? "", coach: coach ?? "" });
  }
  return rows;
}

function toTimeIso(hhmm: string): string {
  return `1970-01-01T${hhmm}:00.000Z`;
}

@Injectable()
export class TimetablesService {
  constructor(private prisma: PrismaService) {}

  async upload(academyId: string, userId: string, fileBuffer: Buffer, termLabel?: string) {
    const rawRows = parseCsv(fileBuffer.toString("utf-8"));
    if (rawRows.length === 0) {
      throw new BadRequestException("No data rows found — check the file matches the CSV template.");
    }

    const [grades, sports, centers, coaches] = await Promise.all([
      this.prisma.grade.findMany({ where: { academyId } }),
      this.prisma.sport.findMany(),
      this.prisma.center.findMany({ where: { academyId } }),
      this.prisma.user.findMany({ where: { academyId, role: { in: ["coach", "head_coach"] } } }),
    ]);
    const norm = (s: string) => s.trim().toLowerCase();
    const gradeByName = new Map(grades.map((g) => [norm(g.name), g.id]));
    const sportByName = new Map(sports.map((s) => [norm(s.name), s.key]));
    const centerByName = new Map(centers.map((c) => [norm(c.name), c.id]));
    const coachByName = new Map(coaches.map((c) => [norm(c.name), c.id]));

    const previewRows: PreviewRow[] = rawRows.map((row, i) => {
      const unresolvedFields: string[] = [];
      const resolvedGradeId = gradeByName.get(norm(row.grade)) ?? null;
      if (!resolvedGradeId) unresolvedFields.push("grade");
      const resolvedSportKey = sportByName.get(norm(row.sport)) ?? null;
      if (!resolvedSportKey) unresolvedFields.push("sport");
      const normalizedDay = DAY_NAMES[norm(row.day)] ?? null;
      if (!normalizedDay) unresolvedFields.push("day");
      const resolvedCenterId = row.center ? (centerByName.get(norm(row.center)) ?? null) : null;
      if (row.center && !resolvedCenterId) unresolvedFields.push("center");
      const resolvedCoachId = row.coach ? (coachByName.get(norm(row.coach)) ?? null) : null;
      // Coach left blank or unrecognised does NOT block the row — BRD 4.4:
      // "the Class is created Unassigned ... rather than blocking the whole upload."

      return {
        ...row,
        rowIndex: i,
        resolvedGradeId,
        resolvedSportKey,
        resolvedCenterId,
        resolvedCoachId,
        normalizedDay,
        unresolvedFields,
        conflict: false,
      };
    });

    // Conflict detection: same Center + Day + StartTime + EndTime used twice,
    // scoped per Center regardless of academy/class (Addendum v3 4.4 / 7).
    const seen = new Map<string, number>();
    for (const row of previewRows) {
      if (!row.resolvedCenterId || !row.normalizedDay) continue;
      const key = `${row.resolvedCenterId}|${row.normalizedDay}|${row.startTime}|${row.endTime}`;
      if (seen.has(key)) {
        row.conflict = true;
        previewRows[seen.get(key)!].conflict = true;
      } else {
        seen.set(key, row.rowIndex);
      }
    }

    return this.prisma.timetable.create({
      data: {
        academyId,
        uploadedBy: userId,
        termLabel,
        status: "processing",
        previewData: { rows: previewRows } as object,
      },
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const timetable = await this.prisma.timetable.findUnique({ where: { id } });
    if (!timetable) throw new NotFoundException("Timetable not found.");
    if (timetable.academyId !== academyId) throw new ForbiddenException();
    return timetable;
  }

  // BRD 4.4/4.10 — creates/updates Classes (one per unique Grade+Section+Sport)
  // from the resolved, conflict-free rows; unresolved/conflicting rows are
  // skipped (never silently dropped — they stay visible in previewData for
  // the Admin to fix and re-upload). Reuses the existing Class/timings model
  // unchanged — ScheduledSession generation is a separate, already-existing
  // action (Academy Operations > Class Schedule > Generate) the Admin runs
  // afterward, exactly as for any manually-created class.
  async commit(academyId: string, id: string) {
    const timetable = await this.findOneOrThrow(academyId, id);
    if (timetable.status !== "processing") {
      throw new BadRequestException("This timetable has already been committed.");
    }
    const rows = ((timetable.previewData as { rows: PreviewRow[] } | null)?.rows ?? []).filter(
      (r) => r.unresolvedFields.length === 0 && !r.conflict
    );
    const skippedCount = ((timetable.previewData as { rows: PreviewRow[] } | null)?.rows.length ?? 0) - rows.length;

    const groups = new Map<string, PreviewRow[]>();
    for (const row of rows) {
      const key = `${row.resolvedGradeId}|${row.section}|${row.resolvedSportKey}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const createdOrUpdatedClassIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const [, groupRows] of groups) {
        const first = groupRows[0];
        const grade = await tx.grade.findUniqueOrThrow({ where: { id: first.resolvedGradeId! } });
        const sport = await tx.sport.findUniqueOrThrow({ where: { key: first.resolvedSportKey! } });
        const centerId = groupRows.find((r) => r.resolvedCenterId)?.resolvedCenterId;
        const coachId = groupRows.find((r) => r.resolvedCoachId)?.resolvedCoachId ?? null;

        // Merge same start/end time across days into one ClassTiming entry,
        // matching the existing Class.timings convention used elsewhere.
        const byTime = new Map<string, string[]>();
        for (const r of groupRows) {
          const timeKey = `${r.startTime}|${r.endTime}`;
          byTime.set(timeKey, [...(byTime.get(timeKey) ?? []), r.normalizedDay!]);
        }
        const timings = Array.from(byTime.entries()).map(([timeKey, days]) => {
          const [startTime, endTime] = timeKey.split("|");
          return { days, startTime, endTime };
        });

        const title = `${grade.name}${first.section ? ` - ${first.section}` : ""} - ${sport.name}`;

        let classRow = await tx.class.findFirst({
          where: { center: { academyId }, gradeId: grade.id, section: first.section || null, sportKey: sport.key },
        });
        if (classRow) {
          classRow = await tx.class.update({
            where: { id: classRow.id },
            data: { timings: timings as object, coachId: coachId ?? undefined, centerId: centerId ?? classRow.centerId },
          });
        } else {
          if (!centerId) {
            throw new BadRequestException(`No center resolved for ${title} — cannot create a class without one.`);
          }
          classRow = await tx.class.create({
            data: {
              centerId,
              title,
              sportKey: sport.key,
              gradeId: grade.id,
              section: first.section || null,
              coachId: coachId ?? undefined,
              timings: timings as object,
            },
          });
        }
        createdOrUpdatedClassIds.push(classRow.id);

        for (const r of groupRows) {
          await tx.timetablePeriod.create({
            data: {
              timetableId: id,
              gradeId: r.resolvedGradeId!,
              section: r.section,
              dayOfWeek: r.normalizedDay!,
              startTime: new Date(toTimeIso(r.startTime)),
              endTime: new Date(toTimeIso(r.endTime)),
              sportKey: r.resolvedSportKey!,
              centerId: r.resolvedCenterId,
              coachId: r.resolvedCoachId,
              resolvedClassId: classRow.id,
            },
          });
        }
      }
      await tx.timetable.update({ where: { id }, data: { status: "active" } });
    });

    return { classIds: createdOrUpdatedClassIds, committedRows: rows.length, skippedRows: skippedCount };
  }
}
