import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCenterDto } from "./dto/create-center.dto";
import type { UpdateCenterDto } from "./dto/update-center.dto";

@Injectable()
export class CentersService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string) {
    return this.prisma.center.findMany({ where: { academyId }, orderBy: { name: "asc" } });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const center = await this.prisma.center.findUnique({ where: { id } });
    if (!center) throw new NotFoundException("Center not found.");
    if (center.academyId !== academyId) throw new ForbiddenException();
    return center;
  }

  create(academyId: string, dto: CreateCenterDto) {
    return this.prisma.center.create({ data: { ...dto, academyId } });
  }

  async update(academyId: string, id: string, dto: UpdateCenterDto) {
    await this.findOneOrThrow(academyId, id);
    return this.prisma.center.update({ where: { id }, data: dto });
  }
}
