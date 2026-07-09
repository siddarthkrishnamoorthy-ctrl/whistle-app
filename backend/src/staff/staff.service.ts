import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateStaffDto } from "./dto/create-staff.dto";
import type { UpdateStaffDto } from "./dto/update-staff.dto";

const PASSWORD_SALT_ROUNDS = 10;

// Never select passwordHash onto a staff profile response — it's easy to
// pull in accidentally via `include: { user: true }`, which grabs every
// column including the hash.
const SAFE_STAFF_INCLUDE = {
  user: { select: { id: true, academyId: true, name: true, email: true, phone: true, role: true, createdAt: true } },
  center: true,
} as const;

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string) {
    return this.prisma.staffProfile.findMany({
      where: { user: { academyId } },
      include: SAFE_STAFF_INCLUDE,
      orderBy: { user: { name: "asc" } },
    });
  }

  async findOneOrThrow(academyId: string, userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: SAFE_STAFF_INCLUDE,
    });
    if (!staff || staff.user.academyId !== academyId) throw new NotFoundException("Staff member not found.");
    return staff;
  }

  async create(academyId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists.");

    if (dto.centerId) {
      const center = await this.prisma.center.findUnique({ where: { id: dto.centerId } });
      if (!center || center.academyId !== academyId) throw new ForbiddenException("Center not in this academy.");
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, PASSWORD_SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { academyId, name: dto.fullName, email: dto.email, passwordHash, role: dto.role },
      });
      const staffProfile = await tx.staffProfile.create({
        data: {
          userId: user.id,
          skills: dto.skills ?? [],
          centerId: dto.centerId,
          reportingManagerId: dto.reportingManagerId,
          salaryBasis: dto.salaryBasis,
          salaryAmount: dto.salaryAmount,
          moduleAccess: dto.moduleAccess ?? [],
        },
        include: SAFE_STAFF_INCLUDE,
      });
      return staffProfile;
    });
  }

  // Any staff member can read their own profile — the mobile apps use this
  // to tailor navigation to the granted modules.
  findOwn(userId: string) {
    return this.prisma.staffProfile.findUnique({ where: { userId }, include: SAFE_STAFF_INCLUDE });
  }

  async update(academyId: string, userId: string, dto: UpdateStaffDto) {
    await this.findOneOrThrow(academyId, userId);
    return this.prisma.staffProfile.update({
      where: { userId },
      data: dto,
      include: SAFE_STAFF_INCLUDE,
    });
  }
}
