import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(academyId: string) {
    const plans = await this.prisma.plan.findMany({
      where: { academyId },
      include: { _count: { select: { classPlans: true, enrollments: true } } },
      orderBy: { title: "asc" },
    });
    return plans.map((p) => ({
      ...p,
      classesCount: p._count.classPlans,
      clientsCount: p._count.enrollments,
      _count: undefined,
    }));
  }

  async findOneOrThrow(academyId: string, id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        classPlans: { include: { class: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!plan) throw new NotFoundException("Plan not found.");
    if (plan.academyId !== academyId) throw new ForbiddenException();
    return plan;
  }

  create(academyId: string, dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: { ...dto, academyId } });
  }

  async update(academyId: string, id: string, dto: UpdatePlanDto) {
    await this.assertOwnership(academyId, id);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  async remove(academyId: string, id: string, force: boolean) {
    await this.assertOwnership(academyId, id);
    const activeEnrollments = await this.prisma.enrollment.count({
      where: { planId: id, status: { in: ["active", "due", "overdue"] } },
    });
    if (activeEnrollments > 0 && !force) {
      throw new ConflictException(
        `This plan has ${activeEnrollments} active enrollment(s). Pass force=true to delete anyway.`
      );
    }
    await this.prisma.plan.delete({ where: { id } });
  }

  async linkClass(academyId: string, planId: string, classId: string) {
    await this.assertOwnership(academyId, planId);
    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) throw new NotFoundException("Class not found.");
    const center = await this.prisma.center.findUnique({ where: { id: klass.centerId } });
    if (!center || center.academyId !== academyId) throw new ForbiddenException();

    return this.prisma.classPlan.upsert({
      where: { classId_planId: { classId, planId } },
      update: {},
      create: { classId, planId },
    });
  }

  private async assertOwnership(academyId: string, id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plan not found.");
    if (plan.academyId !== academyId) throw new ForbiddenException();
  }
}
