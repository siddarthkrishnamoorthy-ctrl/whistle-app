import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSemesterDto } from "./dto/create-semester.dto";

@Injectable()
export class SemestersService {
  constructor(private prisma: PrismaService) {}

  async findAll(academyId: string) {
    const semesters = await this.prisma.semester.findMany({
      where: { academyId },
      include: { lessonPlans: true },
      orderBy: { title: "asc" },
    });
    return semesters.map((s) => this.withProgress(s));
  }

  async findOneOrThrow(academyId: string, id: string) {
    const semester = await this.prisma.semester.findUnique({ where: { id }, include: { lessonPlans: true } });
    if (!semester) throw new NotFoundException("Semester not found.");
    if (semester.academyId !== academyId) throw new ForbiddenException();
    return this.withProgress(semester);
  }

  create(academyId: string, dto: CreateSemesterDto) {
    return this.prisma.semester.create({ data: { ...dto, academyId } });
  }

  // Recomputes and persists status from lesson-plan completion (BRD 7.3.8):
  // completing the last lesson plan in a semester auto-flips it to Completed.
  async recomputeStatus(id: string) {
    const semester = await this.prisma.semester.findUniqueOrThrow({ where: { id }, include: { lessonPlans: true } });
    const total = semester.lessonPlans.length;
    const done = semester.lessonPlans.filter((lp) => lp.status === "completed").length;
    const status = total > 0 && done === total ? "completed" : done > 0 ? "in_progress" : "planned";
    if (status !== semester.status) {
      await this.prisma.semester.update({ where: { id }, data: { status } });
    }
    return status;
  }

  private withProgress<T extends { lessonPlans: { status: string }[] }>(semester: T) {
    const total = semester.lessonPlans.length;
    const done = semester.lessonPlans.filter((lp) => lp.status === "completed").length;
    return { ...semester, lessonPlansTotal: total, lessonPlansDone: done };
  }
}
