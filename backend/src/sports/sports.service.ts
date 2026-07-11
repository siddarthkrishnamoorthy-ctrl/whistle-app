import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { allowedSportsFor } from "../common/sport-access";
import type { CreateSportDto } from "./dto/create-sport.dto";

@Injectable()
export class SportsService {
  constructor(private prisma: PrismaService) {}

  // Filtered by the caller's tenant sport grant: a tenant only sees the
  // sports Whistle gave them access to (every dropdown builds off this list).
  async findAll(academyId?: string | null) {
    const allowed = await allowedSportsFor(this.prisma, academyId);
    return this.prisma.sport.findMany({
      where: allowed ? { key: { in: allowed } } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async create(dto: CreateSportDto) {
    const key = dto.key ?? dto.name.trim().toLowerCase().replace(/\s+/g, "_");
    const existing = await this.prisma.sport.findUnique({ where: { key } });
    if (existing) throw new ConflictException(`A sport with key "${key}" already exists.`);
    return this.prisma.sport.create({ data: { key, name: dto.name, icon: dto.icon } });
  }
}
