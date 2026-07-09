import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
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

  findAll(academyId: string, status?: string) {
    return this.prisma.lessonPlan.findMany({
      where: { academyId, ...(status ? { status } : {}) },
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
    if (plan.academyId !== academyId) throw new ForbiddenException();
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
    await this.findOneOrThrow(academyId, id);
    const whatToBring = dto.sessionFlow ? await this.aggregateEquipment(academyId, dto.sessionFlow) : undefined;
    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        ...dto,
        sessionFlow: dto.sessionFlow ? (dto.sessionFlow as unknown as object) : undefined,
        ...(whatToBring ? { whatToBring } : {}),
      },
      include: { class: true, sport: true },
    });
  }

  async assignToClass(academyId: string, id: string, classId: string) {
    await this.findOneOrThrow(academyId, id);
    const klass = await this.prisma.class.findUnique({ where: { id: classId }, include: { center: true } });
    if (!klass) throw new NotFoundException("Class not found.");
    if (klass.center.academyId !== academyId) throw new ForbiddenException();
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
    const updated = await this.prisma.lessonPlan.update({ where: { id }, data: { status: "completed" } });
    if (existing.semesterId) await this.semestersService.recomputeStatus(existing.semesterId);
    return updated;
  }

  private async aggregateEquipment(academyId: string, sessionFlow?: SessionFlowStepDto[]): Promise<string[]> {
    if (!sessionFlow || sessionFlow.length === 0) return [];
    const drillIds = [...new Set(sessionFlow.map((s) => s.drillId))];
    const drills = await this.prisma.drill.findMany({
      where: { id: { in: drillIds }, academyId },
      select: { equipment: true },
    });
    return [...new Set(drills.flatMap((d) => d.equipment))];
  }
}
