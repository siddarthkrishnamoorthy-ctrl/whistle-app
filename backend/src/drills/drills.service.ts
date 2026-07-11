import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { allowedSportsFor } from "../common/sport-access";
import type { CreateDrillDto } from "./dto/create-drill.dto";
import type { UpdateDrillDto } from "./dto/update-drill.dto";

@Injectable()
export class DrillsService {
  constructor(private prisma: PrismaService) {}

  // The drill bank is Whistle's platform library (academyId null), curated by
  // the operator (2026-07). Tenants read it — filtered to their granted
  // sports — plus any legacy drills they authored before the library existed.
  async findAll(academyId: string, filters: { sportKey?: string; level?: string; ageGroup?: string; search?: string }) {
    const allowed = await allowedSportsFor(this.prisma, academyId);
    return this.prisma.drill.findMany({
      where: {
        OR: [{ academyId }, { academyId: null, ...(allowed ? { sportKey: { in: allowed } } : {}) }],
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
    // Platform drills (academyId null) are readable by every tenant.
    if (drill.academyId !== null && drill.academyId !== academyId) throw new ForbiddenException();
    return drill;
  }

  // Tenant-side mutations are closed: the drill bank is made by Whistle, not
  // tenants. (Owner CRUD lives on the /platform routes.)
  create(_academyId: string, _dto: CreateDrillDto): never {
    throw new ForbiddenException("The Whistle drill library is managed by the platform operator.");
  }

  update(_academyId: string, _id: string, _dto: UpdateDrillDto): never {
    throw new ForbiddenException("The Whistle drill library is managed by the platform operator.");
  }

  remove(_academyId: string, _id: string): never {
    throw new ForbiddenException("The Whistle drill library is managed by the platform operator.");
  }
}
