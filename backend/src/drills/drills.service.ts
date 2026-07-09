import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateDrillDto } from "./dto/create-drill.dto";
import type { UpdateDrillDto } from "./dto/update-drill.dto";

@Injectable()
export class DrillsService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string, filters: { sportKey?: string; level?: string; ageGroup?: string; search?: string }) {
    return this.prisma.drill.findMany({
      where: {
        academyId,
        ...(filters.sportKey ? { sportKey: filters.sportKey } : {}),
        ...(filters.level ? { level: filters.level as never } : {}),
        ...(filters.ageGroup ? { ageGroups: { has: filters.ageGroup } } : {}),
        ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
      },
      include: { sport: true },
      orderBy: { title: "asc" },
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const drill = await this.prisma.drill.findUnique({ where: { id }, include: { sport: true } });
    if (!drill) throw new NotFoundException("Drill not found.");
    if (drill.academyId !== academyId) throw new ForbiddenException();
    return drill;
  }

  create(academyId: string, dto: CreateDrillDto) {
    return this.prisma.drill.create({ data: { ...dto, academyId }, include: { sport: true } });
  }

  async update(academyId: string, id: string, dto: UpdateDrillDto) {
    await this.findOneOrThrow(academyId, id);
    return this.prisma.drill.update({ where: { id }, data: dto, include: { sport: true } });
  }

  async remove(academyId: string, id: string) {
    await this.findOneOrThrow(academyId, id);
    await this.prisma.drill.delete({ where: { id } });
  }
}
