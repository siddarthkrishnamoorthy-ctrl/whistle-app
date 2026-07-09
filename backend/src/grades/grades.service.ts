import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_GRADES } from "../auth/auth.service";
import type { CreateGradeDto } from "./dto/create-grade.dto";
import type { UpdateGradeDto } from "./dto/update-grade.dto";

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  async findAll(academyId: string) {
    const grades = await this.prisma.grade.findMany({ where: { academyId }, orderBy: { sortOrder: "asc" } });
    // Backfills academies created before this addendum shipped (grades are
    // now seeded at signup — see auth.service.ts) rather than requiring a
    // one-off data migration script for existing installs.
    if (grades.length === 0) {
      return this.seedDefaults(academyId);
    }
    return grades;
  }

  seedDefaults(academyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.grade.createMany({
        data: DEFAULT_GRADES.map((name, i) => ({ academyId, name, sortOrder: i })),
        skipDuplicates: true,
      });
      return tx.grade.findMany({ where: { academyId }, orderBy: { sortOrder: "asc" } });
    });
  }

  async create(academyId: string, dto: CreateGradeDto) {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(academyId));
    return this.prisma.grade.create({ data: { academyId, name: dto.name, sortOrder } });
  }

  private async nextSortOrder(academyId: string): Promise<number> {
    const max = await this.prisma.grade.aggregate({ where: { academyId }, _max: { sortOrder: true } });
    return (max._max.sortOrder ?? -1) + 1;
  }

  async update(academyId: string, id: string, dto: UpdateGradeDto) {
    const grade = await this.prisma.grade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException("Grade not found.");
    if (grade.academyId !== academyId) throw new ForbiddenException();
    return this.prisma.grade.update({ where: { id }, data: { name: dto.name } });
  }
}
