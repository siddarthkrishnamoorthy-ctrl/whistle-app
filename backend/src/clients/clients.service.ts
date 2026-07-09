import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { SkillLevel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateLinkCode } from "../common/prisma-selects";
import type { CreateClientDto } from "./dto/create-client.dto";
import type { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(academyId: string) {
    const clients = await this.prisma.client.findMany({
      where: { academyId },
      include: {
        enrollments: { include: { plan: true, class: true }, orderBy: { endDate: "desc" }, take: 1 },
        invoices: { where: { status: "pending" } },
      },
      orderBy: { name: "asc" },
    });
    return clients.map((c) => this.withComputed(c));
  }

  async findOneOrThrow(academyId: string, id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        center: true,
        enrollments: { include: { plan: true, class: true }, orderBy: { startDate: "desc" } },
        invoices: { orderBy: { issuedAt: "desc" } },
        guardians: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      },
    });
    if (!client) throw new NotFoundException("Client not found.");
    if (client.academyId !== academyId) throw new ForbiddenException();
    return this.withComputed(client);
  }

  async create(academyId: string, dto: CreateClientDto) {
    const { planId, classId, startDate, ...clientFields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: { ...clientFields, academyId, linkCode: generateLinkCode() },
      });

      if (planId && classId) {
        const plan = await tx.plan.findUnique({ where: { id: planId } });
        if (!plan || plan.academyId !== academyId) throw new ForbiddenException("Plan not in this academy.");
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        if (plan.durationUnit === "day") end.setDate(end.getDate() + (plan.durationValue ?? 1));
        else if (plan.durationUnit === "week") end.setDate(end.getDate() + (plan.durationValue ?? 1) * 7);
        else if (plan.durationUnit === "year") end.setFullYear(end.getFullYear() + (plan.durationValue ?? 1));
        else end.setMonth(end.getMonth() + (plan.durationValue ?? 1));

        await tx.enrollment.create({
          data: {
            clientId: client.id,
            planId,
            classId,
            startDate: start,
            endDate: end,
            sessionsLeft: plan.sessionsIncluded,
            status: "active",
          },
        });
      }

      return client;
    });
  }

  async update(academyId: string, id: string, dto: UpdateClientDto) {
    await this.findOneOrThrow(academyId, id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  // No creation path existed anywhere for ClientSkillLevel — BRD 7.3.2 shows
  // a per-class skill level on the client record, and BRD 11.3's Rating
  // Engine requires it as the seed for a student's starting rating, but
  // nothing let an admin actually set one. Upsert since a client only has
  // one level per sport (BRD 8.2's Beginner/Intermediate/Advanced).
  async setSkillLevel(academyId: string, id: string, sportKey: string, level: SkillLevel) {
    const client = await this.findOneOrThrow(academyId, id);
    return this.prisma.clientSkillLevel.upsert({
      where: { clientId_sportKey: { clientId: client.id, sportKey } },
      create: { clientId: client.id, sportKey, level },
      update: { level },
    });
  }

  skillLevels(academyId: string, id: string) {
    return this.findOneOrThrow(academyId, id).then(() =>
      this.prisma.clientSkillLevel.findMany({ where: { clientId: id }, include: { sport: true } })
    );
  }

  private withComputed<
    T extends { invoices?: { amount: unknown; status: string }[]; enrollments?: { status: string }[] },
  >(client: T) {
    const balanceDue = (client.invoices ?? [])
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + Number(i.amount), 0);
    const activeEnrollment = (client.enrollments ?? [])[0];
    return { ...client, balanceDue, status: activeEnrollment?.status ?? "active" };
  }
}
