import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { allowedSportsFor } from "../common/sport-access";
import { ageBandFields } from "../common/age-bands";
import { SemestersService } from "../semesters/semesters.service";
import type { CreateLessonPlanDto } from "./dto/create-lesson-plan.dto";
import type { UpdateLessonPlanDto } from "./dto/update-lesson-plan.dto";
import type { SessionFlowStepDto } from "./dto/session-flow-step.dto";

@Injectable()
export class LessonPlansService {
  constructor(
    private prisma: PrismaService,
    private semestersService: SemestersService
  ) {}

  // Tenants see Whistle's platform repository (academyId null, limited to
  // their granted sports) alongside their own working copies (2026-07).
  async findAll(academyId: string, status?: string) {
    const allowed = await allowedSportsFor(this.prisma, academyId);
    return this.prisma.lessonPlan.findMany({
      where: {
        OR: [{ academyId }, { academyId: null, ...(allowed ? { sportKey: { in: allowed } } : {}) }],
        ...(status ? { status } : {}),
      },
      include: { class: true, sport: true },
      orderBy: { title: "asc" },
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const plan = await this.prisma.lessonPlan.findUnique({
      where: { id },
      include: { class: true, sport: true, semester: true },
    });
    if (!plan) throw new NotFoundException("Lesson plan not found.");
    // Platform repository plans (academyId null) are readable by every tenant.
    if (plan.academyId !== null && plan.academyId !== academyId) throw new ForbiddenException();
    return plan;
  }

  async create(academyId: string, dto: CreateLessonPlanDto) {
    const whatToBring = await this.aggregateEquipment(academyId, dto.sessionFlow);
    return this.prisma.lessonPlan.create({
      data: {
        academyId,
        title: dto.title,
        classId: dto.classId,
        semesterId: dto.semesterId,
        sportKey: dto.sportKey,
        level: dto.level,
        ...ageBandFields(dto.ageBand),
        goals: dto.goals,
        objectives: dto.objectives ?? [],
        targetDurationMin: dto.targetDurationMin,
        sessionFlow: (dto.sessionFlow ?? []) as unknown as object,
        whatToBring,
      },
      include: { class: true, sport: true },
    });
  }

  async update(academyId: string, id: string, dto: UpdateLessonPlanDto) {
    const existing = await this.findOneOrThrow(academyId, id);
    // Repository masters are owner-curated — tenants adopt a copy instead.
    if (existing.academyId === null) {
      throw new ForbiddenException("This is a Whistle repository plan — duplicate it to customise a copy for your academy.");
    }
    const whatToBring = dto.sessionFlow ? await this.aggregateEquipment(academyId, dto.sessionFlow) : undefined;
    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        ...dto,
        sessionFlow: dto.sessionFlow ? (dto.sessionFlow as unknown as object) : undefined,
        ...(dto.ageBand !== undefined ? ageBandFields(dto.ageBand) : {}),
        ...(whatToBring ? { whatToBring } : {}),
      },
      include: { class: true, sport: true },
    });
  }

  async assignToClass(academyId: string, id: string, classId: string) {
    const plan = await this.findOneOrThrow(academyId, id);
    const klass = await this.prisma.class.findUnique({ where: { id: classId }, include: { center: true } });
    if (!klass) throw new NotFoundException("Class not found.");
    if (klass.center.academyId !== academyId) throw new ForbiddenException();
    // Assigning a repository master would leak one tenant's class onto the
    // shared row — adopt a per-academy copy and assign that instead.
    if (plan.academyId === null) {
      return this.prisma.lessonPlan.create({
        data: {
          academyId,
          classId,
          title: plan.title,
          sportKey: plan.sportKey,
          level: plan.level,
          goals: plan.goals,
          objectives: plan.objectives,
          targetDurationMin: plan.targetDurationMin,
          sessionFlow: plan.sessionFlow as object,
          whatToBring: plan.whatToBring,
          status: "upcoming",
        },
        include: { class: true },
      });
    }
    return this.prisma.lessonPlan.update({ where: { id }, data: { classId }, include: { class: true } });
  }

  async duplicate(academyId: string, id: string) {
    const original = await this.findOneOrThrow(academyId, id);
    return this.prisma.lessonPlan.create({
      data: {
        academyId,
        title: `${original.title} (copy)`,
        sportKey: original.sportKey,
        level: original.level,
        goals: original.goals,
        objectives: original.objectives,
        targetDurationMin: original.targetDurationMin,
        sessionFlow: original.sessionFlow as object,
        whatToBring: original.whatToBring,
        status: "upcoming",
      },
    });
  }

  async markComplete(academyId: string, id: string) {
    const existing = await this.findOneOrThrow(academyId, id);
    if (existing.academyId === null) {
      throw new ForbiddenException("Repository plans aren't completed directly — duplicate one into your academy first.");
    }
    const updated = await this.prisma.lessonPlan.update({ where: { id }, data: { status: "completed" } });
    if (existing.semesterId) await this.semestersService.recomputeStatus(existing.semesterId);
    return updated;
  }

  private async aggregateEquipment(academyId: string, sessionFlow?: SessionFlowStepDto[]): Promise<string[]> {
    if (!sessionFlow || sessionFlow.length === 0) return [];
    const drillIds = [...new Set(sessionFlow.map((s) => s.drillId))];
    const drills = await this.prisma.drill.findMany({
      where: { id: { in: drillIds }, OR: [{ academyId }, { academyId: null }] },
      select: { equipment: true },
    });
    return [...new Set(drills.flatMap((d) => d.equipment))];
  }
}
