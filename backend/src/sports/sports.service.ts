import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSportDto } from "./dto/create-sport.dto";

@Injectable()
export class SportsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.sport.findMany({ orderBy: { name: "asc" } });
  }

  async create(dto: CreateSportDto) {
    const key = dto.key ?? dto.name.trim().toLowerCase().replace(/\s+/g, "_");
    const existing = await this.prisma.sport.findUnique({ where: { key } });
    if (existing) throw new ConflictException(`A sport with key "${key}" already exists.`);
    return this.prisma.sport.create({ data: { key, name: dto.name, icon: dto.icon } });
  }
}
