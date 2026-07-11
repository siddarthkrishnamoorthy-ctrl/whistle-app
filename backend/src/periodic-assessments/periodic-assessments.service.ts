import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Periodic Assessment module (Assessment Module BRD v1.0): standardized
// fitness/skill test cycles on a Monthly/Quarterly/Half-Yearly/Annual
// cadence. Numeric results only — this module never touches media.

const CADENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, half_yearly: 6, annual: 12 };

export interface TestDto {
  name: string;
  category: string;
  applicableGradeIds?: string[];
  metricType: "time" | "repetitions" | "distance_height";
  unit: string;
  precisionDecimals?: number;
  attemptsAllowed?: number;
  instructions?: string;
  zones?: {
    ageMin?: number;
    ageMax?: number;
    gender?: string;
    zoneName: string;
    thresholdLow?: number;
    thresholdHigh?: number;
  }[];
}

export interface CycleDto {
  title: string;
  cadence: "monthly" | "quarterly" | "half_yearly" | "annual";
  testIds: string[];
  gradeIds?: string[];
  classIds?: string[];
  windowStart: string;
  windowEnd: string;
}

@Injectable()
export class PeriodicAssessmentsService {
  constructor(private prisma: PrismaService) {}

  // ── Test Library (BRD 4.1) — Admin/Account Manager maintain it ───────────

  listTests(academyId: string) {
    // Academies see Whistle's platform test library (academyId null, curated
    // by the operator) alongside any tests they authored themselves.
    return this.prisma.assessmentTest.findMany({
      where: { OR: [{ academyId }, { academyId: null }] },
      include: { zones: true },
      orderBy: { name: "asc" },
    });
  }

  async createTest(academyId: string, userId: string, dto: TestDto) {
    if (!["time", "repetitions", "distance_height"].includes(dto.metricType)) {
      throw new BadRequestException("Metric type must be time, repetitions or distance_height.");
    }
    return this.prisma.assessmentTest.create({
      data: {
        academyId,
        name: dto.name.trim(),
        category: dto.category,
        applicableGradeIds: dto.applicableGradeIds ?? [],
        metricType: dto.metricType,
        unit: dto.unit,
        precisionDecimals: dto.precisionDecimals ?? (dto.metricType === "time" ? 2 : 0),
        attemptsAllowed: Math.max(1, Math.min(5, dto.attemptsAllowed ?? 1)),
        instructions: dto.instructions,
        createdById: userId,
        zones: {
          create: (dto.zones ?? []).map((z) => ({
            ageMin: z.ageMin,
            ageMax: z.ageMax,
            gender: z.gender ?? "any",
            zoneName: z.zoneName,
            thresholdLow: z.thresholdLow,
            thresholdHigh: z.thresholdHigh,
          })),
        },
      },
      include: { zones: true },
    });
  }

  async updateTest(academyId: string, id: string, dto: Partial<TestDto>) {
    const existing = await this.prisma.assessmentTest.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) throw new NotFoundException("Test not found.");
    if (dto.zones) {
      await this.prisma.assessmentBenchmarkZone.deleteMany({ where: { testId: id } });
    }
    return this.prisma.assessmentTest.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: dto.category,
        applicableGradeIds: dto.applicableGradeIds,
        metricType: dto.metricType,
        unit: dto.unit,
        precisionDecimals: dto.precisionDecimals,
        attemptsAllowed: dto.attemptsAllowed,
        instructions: dto.instructions,
        zones: dto.zones
          ? {
              create: dto.zones.map((z) => ({
                ageMin: z.ageMin,
                ageMax: z.ageMax,
                gender: z.gender ?? "any",
                zoneName: z.zoneName,
                thresholdLow: z.thresholdLow,
                thresholdHigh: z.thresholdHigh,
              })),
            }
          : undefined,
      },
      include: { zones: true },
    });
  }

  // ── Cycles (BRD 4.2) — recurring cycles auto-generate their successor ────

  async listCycles(academyId: string) {
    await this.rolloverDueCycles(academyId);
    const cycles = await this.prisma.assessmentCycle.findMany({
      where: { academyId },
      orderBy: [{ status: "asc" }, { windowStart: "desc" }],
    });
    const tests = await this.prisma.assessmentTest.findMany({ where: { academyId } });
    return Promise.all(
      cycles.map(async (c) => {
        const roster = await this.rosterClientIds(academyId, c.gradeIds, c.classIds);
        const results = await this.prisma.periodicAssessmentResult.findMany({ where: { cycleId: c.id } });
        const expected = roster.length * c.testIds.length;
        const done = results.filter((r) => r.status !== "pending").length;
        return {
          ...c,
          tests: tests.filter((t) => c.testIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name })),
          rosterCount: roster.length,
          expected,
          completed: done,
          completionPct: expected ? Math.round((done / expected) * 100) : 0,
        };
      })
    );
  }

  async createCycle(academyId: string, dto: CycleDto) {
    if (!CADENCE_MONTHS[dto.cadence]) throw new BadRequestException("Cadence must be monthly, quarterly, half_yearly or annual.");
    if (!dto.testIds?.length) throw new BadRequestException("Pick at least one test for the cycle.");
    if (!dto.gradeIds?.length && !dto.classIds?.length) {
      throw new BadRequestException("Pick at least one grade or class.");
    }
    return this.prisma.assessmentCycle.create({
      data: {
        academyId,
        title: dto.title.trim(),
        cadence: dto.cadence,
        testIds: dto.testIds,
        gradeIds: dto.gradeIds ?? [],
        classIds: dto.classIds ?? [],
        windowStart: new Date(dto.windowStart),
        windowEnd: new Date(dto.windowEnd),
      },
    });
  }

  // Once a recurring cycle's window has passed, close it and open the next
  // occurrence automatically (BRD 4.2) — lazy, on read, no scheduler needed.
  private async rolloverDueCycles(academyId: string) {
    const today = new Date();
    const due = await this.prisma.assessmentCycle.findMany({
      where: { academyId, status: "open", windowEnd: { lt: today }, nextGenerated: false },
    });
    for (const c of due) {
      const months = CADENCE_MONTHS[c.cadence] ?? 3;
      const shift = (d: Date) => {
        const n = new Date(d);
        n.setMonth(n.getMonth() + months);
        return n;
      };
      await this.prisma.$transaction([
        this.prisma.assessmentCycle.update({ where: { id: c.id }, data: { status: "closed", nextGenerated: true } }),
        this.prisma.assessmentCycle.create({
          data: {
            academyId,
            title: c.title,
            cadence: c.cadence,
            testIds: c.testIds,
            gradeIds: c.gradeIds,
            classIds: c.classIds,
            windowStart: shift(c.windowStart),
            windowEnd: shift(c.windowEnd),
          },
        }),
      ]);
    }
  }

  // Roster resolution: every active student enrolled in a class that matches
  // the cycle's grades or explicit classes.
  private async rosterClientIds(academyId: string, gradeIds: string[], classIds: string[]) {
    const classes = await this.prisma.class.findMany({
      where: {
        center: { academyId },
        OR: [
          ...(gradeIds.length ? [{ gradeId: { in: gradeIds } }] : []),
          ...(classIds.length ? [{ id: { in: classIds } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!classes.length) return [] as string[];
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: { in: classes.map((c) => c.id) }, status: "active" },
      select: { clientId: true },
    });
    return [...new Set(enrollments.map((e) => e.clientId))];
  }

  // ── Coach recording flow (BRD 4.3) ────────────────────────────────────────

  // Cycles a coach should see: open, window includes/near today, and at least
  // one of their classes falls in the cycle's grade/class scope.
  async dueCycles(academyId: string, userId: string, role: string) {
    await this.rolloverDueCycles(academyId);
    const cycles = await this.prisma.assessmentCycle.findMany({
      where: { academyId, status: "open" },
      orderBy: { windowStart: "asc" },
    });
    const tests = await this.prisma.assessmentTest.findMany({ where: { academyId }, include: { zones: true } });
    const isCoach = role === "coach" || role === "head_coach";
    const myClasses = isCoach
      ? await this.prisma.class.findMany({ where: { coachId: userId }, select: { id: true, gradeId: true } })
      : [];
    return cycles
      .filter((c) => {
        if (!isCoach) return true;
        return myClasses.some(
          (k) => c.classIds.includes(k.id) || (k.gradeId != null && c.gradeIds.includes(k.gradeId))
        );
      })
      .map((c) => ({ ...c, tests: tests.filter((t) => c.testIds.includes(t.id)) }));
  }

  // The class roster for a cycle+test, one row per student with their current
  // result status — the Attendance-style batch entry screen (BRD 4.3).
  async roster(academyId: string, cycleId: string, testId: string) {
    const cycle = await this.cycleOrThrow(academyId, cycleId);
    if (!cycle.testIds.includes(testId)) throw new BadRequestException("That test isn't part of this cycle.");
    const clientIds = await this.rosterClientIds(academyId, cycle.gradeIds, cycle.classIds);
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, dob: true, gender: true },
      orderBy: { name: "asc" },
    });
    const results = await this.prisma.periodicAssessmentResult.findMany({
      where: { cycleId, testId, clientId: { in: clientIds } },
      include: { attempts: { orderBy: { attemptNo: "asc" } } },
    });
    const test = await this.prisma.assessmentTest.findUnique({ where: { id: testId }, include: { zones: true } });
    return {
      cycle: { id: cycle.id, title: cycle.title, windowStart: cycle.windowStart, windowEnd: cycle.windowEnd },
      test,
      students: clients.map((c) => {
        const r = results.find((x) => x.clientId === c.id);
        return {
          clientId: c.id,
          name: c.name,
          status: r?.status ?? "pending",
          bestValue: r?.bestValue != null ? Number(r.bestValue) : null,
          benchmarkZone: r?.benchmarkZone ?? null,
          attempts: r?.attempts.map((a) => Number(a.value)) ?? [],
        };
      }),
    };
  }

  // Record a student's result: best-of-attempts kept as official, every
  // attempt retained; or mark absent/exempt (BRD 4.3, acceptance 4/6).
  async record(
    academyId: string,
    userId: string,
    cycleId: string,
    body: { testId: string; clientId: string; attempts?: number[]; status?: "absent" | "exempt" }
  ) {
    const cycle = await this.cycleOrThrow(academyId, cycleId);
    if (cycle.status !== "open") throw new BadRequestException("This cycle is closed.");
    const test = await this.prisma.assessmentTest.findUnique({ where: { id: body.testId }, include: { zones: true } });
    if (!test || !cycle.testIds.includes(test.id)) throw new BadRequestException("That test isn't part of this cycle.");
    const client = await this.prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client || client.academyId !== academyId) throw new NotFoundException("Student not found.");

    if (body.status === "absent" || body.status === "exempt") {
      return this.prisma.periodicAssessmentResult.upsert({
        where: { cycleId_testId_clientId: { cycleId, testId: test.id, clientId: client.id } },
        update: { status: body.status, bestValue: null, benchmarkZone: null, recordedById: userId, recordedAt: new Date() },
        create: { cycleId, testId: test.id, clientId: client.id, status: body.status, recordedById: userId, recordedAt: new Date() },
      });
    }

    const attempts = (body.attempts ?? []).filter((v) => Number.isFinite(v) && v >= 0);
    if (!attempts.length) throw new BadRequestException("Record at least one attempt value.");
    if (attempts.length > test.attemptsAllowed) {
      throw new BadRequestException(`This test allows ${test.attemptsAllowed} attempt(s).`);
    }
    // Best = lowest time, highest reps/distance (BRD 4.1 metric type).
    const best = test.metricType === "time" ? Math.min(...attempts) : Math.max(...attempts);
    const zone = this.resolveZone(test, client, best);

    const result = await this.prisma.periodicAssessmentResult.upsert({
      where: { cycleId_testId_clientId: { cycleId, testId: test.id, clientId: client.id } },
      update: { status: "recorded", bestValue: best, benchmarkZone: zone, recordedById: userId, recordedAt: new Date() },
      create: {
        cycleId,
        testId: test.id,
        clientId: client.id,
        status: "recorded",
        bestValue: best,
        benchmarkZone: zone,
        recordedById: userId,
        recordedAt: new Date(),
      },
    });
    await this.prisma.assessmentResultAttempt.deleteMany({ where: { resultId: result.id } });
    await this.prisma.assessmentResultAttempt.createMany({
      data: attempts.map((v, i) => ({ resultId: result.id, attemptNo: i + 1, value: v })),
    });
    return { ...result, bestValue: best, benchmarkZone: zone, attempts };
  }

  // Classified the moment it's entered, banded by age & gender exactly like
  // FitnessGram's HFZ (BRD 4.5) — never a manual lookup.
  private resolveZone(
    test: { zones: { ageMin: number | null; ageMax: number | null; gender: string; zoneName: string; thresholdLow: unknown; thresholdHigh: unknown }[] },
    client: { dob: Date | null; gender: string | null },
    value: number
  ): string | null {
    if (!test.zones.length) return null;
    const age = client.dob ? Math.floor((Date.now() - client.dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
    const g = (client.gender ?? "any").toLowerCase();
    const candidates = test.zones.filter((z) => {
      const genderOk = z.gender === "any" || z.gender === g;
      const ageOk = (z.ageMin == null || (age != null && age >= z.ageMin)) && (z.ageMax == null || (age != null && age <= z.ageMax));
      return genderOk && (age != null ? ageOk : z.ageMin == null && z.ageMax == null);
    });
    for (const z of candidates) {
      const low = z.thresholdLow != null ? Number(z.thresholdLow) : -Infinity;
      const high = z.thresholdHigh != null ? Number(z.thresholdHigh) : Infinity;
      if (value >= low && value < high) return z.zoneName;
    }
    return null;
  }

  // Missing-data view (BRD 4.5): pending ≠ absent ≠ exempt, per student per test.
  async missing(academyId: string, cycleId: string) {
    const cycle = await this.cycleOrThrow(academyId, cycleId);
    const clientIds = await this.rosterClientIds(academyId, cycle.gradeIds, cycle.classIds);
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const tests = await this.prisma.assessmentTest.findMany({ where: { id: { in: cycle.testIds } } });
    const results = await this.prisma.periodicAssessmentResult.findMany({ where: { cycleId } });
    const rows = [];
    for (const c of clients) {
      for (const t of tests) {
        const r = results.find((x) => x.clientId === c.id && x.testId === t.id);
        if (!r || r.status === "pending") {
          rows.push({ clientId: c.id, name: c.name, testId: t.id, testName: t.name, status: "not tested" });
        } else if (r.status === "absent" || r.status === "exempt") {
          rows.push({ clientId: c.id, name: c.name, testId: t.id, testName: t.name, status: r.status });
        }
      }
    }
    return { cycle: { id: cycle.id, title: cycle.title }, rows };
  }

  // ── History & trend (BRD 4.5/4.6) — parent sees own child only ───────────

  async history(academyId: string, userId: string, role: string, clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { guardians: true },
    });
    if (!client || client.academyId !== academyId) throw new NotFoundException("Student not found.");
    if (role === "parent" && !client.guardians.some((g) => g.userId === userId)) {
      throw new ForbiddenException("You can only view your own child's fitness tests.");
    }
    const results = await this.prisma.periodicAssessmentResult.findMany({
      where: { clientId, status: "recorded" },
      include: { cycle: true, test: true, attempts: true },
      orderBy: { recordedAt: "asc" },
    });
    // Group per test so the trend across cycles is directly readable.
    const byTest = new Map<string, { test: { id: string; name: string; unit: string; metricType: string }; results: unknown[] }>();
    for (const r of results) {
      if (!byTest.has(r.testId)) {
        byTest.set(r.testId, {
          test: { id: r.test.id, name: r.test.name, unit: r.test.unit, metricType: r.test.metricType },
          results: [],
        });
      }
      byTest.get(r.testId)!.results.push({
        cycleTitle: r.cycle.title,
        window: r.cycle.windowStart,
        value: Number(r.bestValue),
        benchmarkZone: r.benchmarkZone,
        attempts: r.attempts.map((a) => Number(a.value)),
        recordedAt: r.recordedAt,
      });
    }
    return [...byTest.values()];
  }

  private async cycleOrThrow(academyId: string, cycleId: string) {
    const cycle = await this.prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.academyId !== academyId) throw new NotFoundException("Cycle not found.");
    return cycle;
  }
}
