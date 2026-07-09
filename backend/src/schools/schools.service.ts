import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSchoolDto } from "./dto/create-school.dto";
import type { UpdateSchoolDto } from "./dto/update-school.dto";

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string) {
    return this.prisma.school.findMany({
      where: { academyId },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    });
  }

  create(academyId: string, dto: CreateSchoolDto) {
    return this.prisma.school.create({ data: { academyId, ...dto } });
  }

  async update(academyId: string, id: string, dto: UpdateSchoolDto) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException("School not found.");
    if (school.academyId !== academyId) throw new ForbiddenException();
    return this.prisma.school.update({ where: { id }, data: dto });
  }
}
