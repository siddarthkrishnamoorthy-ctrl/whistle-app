import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SAFE_COACH_INCLUDE, SAFE_USER_SELECT } from "../common/prisma-selects";
import type { CreateClassDto } from "./dto/create-class.dto";
import type { UpdateClassDto } from "./dto/update-class.dto";

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string) {
    return this.prisma.class.findMany({
      where: { center: { academyId } },
      include: {
        sport: true,
        center: true,
        school: true,
        coach: SAFE_COACH_INCLUDE,
        _count: { select: { enrollments: true, classPlans: true } },
      },
      orderBy: { title: "asc" },
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const klass = await this.prisma.class.findUnique({
      where: { id },
      include: {
        sport: true,
        center: true,
        school: true,
        coach: SAFE_COACH_INCLUDE,
        classPlans: { include: { plan: true } },
        lessonPlans: true,
        enrollments: { include: { client: { select: { id: true, name: true } } } },
      },
    });
    if (!klass) throw new NotFoundException("Class not found.");
    if (klass.center.academyId !== academyId) throw new ForbiddenException();
    return klass;
  }

  async create(academyId: string, dto: CreateClassDto) {
    await this.assertCenterInAcademy(academyId, dto.centerId);
    if (dto.coachId) await this.assertCoachInAcademy(academyId, dto.coachId);

    const { timings, ...rest } = dto;
    return this.prisma.class.create({
      data: { ...rest, timings: timings as object[] | undefined },
      include: { sport: true, center: true, school: true, coach: SAFE_COACH_INCLUDE },
    });
  }

  async update(academyId: string, id: string, dto: UpdateClassDto) {
    const existing = await this.findOneOrThrow(academyId, id);
    if (dto.centerId) await this.assertCenterInAcademy(academyId, dto.centerId);
    if (dto.coachId) await this.assertCoachInAcademy(academyId, dto.coachId);

    if (dto.status === "active") {
      const hasCoach = dto.coachId ?? existing.coachId;
      const planCount = await this.prisma.classPlan.count({ where: { classId: id } });
      if (!hasCoach || planCount === 0) {
        throw new BadRequestException(
          "A class needs at least one linked plan and an assigned coach before it can go Active."
        );
      }
    }

    const { timings, ...rest } = dto;
    return this.prisma.class.update({
      where: { id },
      data: { ...rest, timings: timings as object[] | undefined },
      include: { sport: true, center: true, school: true, coach: SAFE_COACH_INCLUDE },
    });
  }

  private async assertCenterInAcademy(academyId: string, centerId: string) {
    const center = await this.prisma.center.findUnique({ where: { id: centerId } });
    if (!center || center.academyId !== academyId) throw new ForbiddenException("Center not in this academy.");
  }

  private async assertCoachInAcademy(academyId: string, coachUserId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: coachUserId },
      select: { userId: true, user: { select: SAFE_USER_SELECT } },
    });
    if (!staff || staff.user.academyId !== academyId) throw new ForbiddenException("Coach not in this academy.");
  }
}
