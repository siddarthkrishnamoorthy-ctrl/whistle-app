import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import type { CreateAssessmentDto } from "./dto/create-assessment.dto";

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  // Parents/students only ever see their own linked child's history — every
  // staff role (admin, coach, ...) can see any client in their academy.
  private async assertCanView(user: AuthenticatedUser, clientId: string, academyId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.academyId !== academyId) throw new NotFoundException("Client not found.");

    if (user.role === "parent" || user.role === "student") {
      const guardian = await this.prisma.clientGuardian.findUnique({
        where: { clientId_userId: { clientId, userId: user.sub } },
      });
      if (!guardian) throw new ForbiddenException("Not linked to this player.");
    }
    return client;
  }

  async findForClient(user: AuthenticatedUser, academyId: string, clientId: string) {
    await this.assertCanView(user, clientId, academyId);
    return this.prisma.assessment.findMany({
      where: { clientId },
      orderBy: { assessedAt: "desc" },
      include: { drill: { select: { id: true, title: true, sportKey: true } }, recorder: { select: { id: true, name: true } } },
    });
  }

  async create(academyId: string, dto: CreateAssessmentDto, recordedBy: string) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || client.academyId !== academyId) throw new NotFoundException("Client not found.");

    return this.prisma.assessment.create({
      data: {
        clientId: dto.clientId,
        drillId: dto.drillId,
        recordedBy,
        timeTakenSec: dto.timeTakenSec,
        repsCompleted: dto.repsCompleted,
        accuracyPct: dto.accuracyPct,
        distanceM: dto.distanceM,
        speedMps: dto.speedMps,
        errorCount: dto.errorCount,
        enduranceTimeSec: dto.enduranceTimeSec,
        staminaIndex: dto.staminaIndex,
        overallRating: dto.overallRating,
        coachNote: dto.coachNote,
      },
      include: { drill: { select: { id: true, title: true, sportKey: true } } },
    });
  }
}
