import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { SkillLevel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateLinkCode } from "../common/prisma-selects";
import type { CreateClientDto } from "./dto/create-client.dto";
import type { BulkImportClientsDto } from "./dto/bulk-import.dto";
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

  // Bulk student-database upload (2026-07): imports rows parsed from a CSV in
  // the admin console. Each row goes through the same create path (so link
  // codes and optional plan/class enrolment behave identically); failures are
  // reported per row instead of aborting the whole file.
  async bulkImport(academyId: string, dto: BulkImportClientsDto) {
    const results: { row: number; name: string; ok: boolean; linkCode?: string; error?: string }[] = [];
    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];
      try {
        const client = await this.create(academyId, {
          name: row.name.trim(),
          email: row.email?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          gender: row.gender?.trim() || undefined,
          // CSVs carry date-only strings; Prisma DateTime needs full ISO.
          dob: row.dob ? new Date(row.dob).toISOString() : undefined,
          centerId: dto.centerId,
          planId: dto.planId,
          classId: dto.classId,
          startDate: dto.startDate,
        });
        results.push({ row: i + 1, name: row.name, ok: true, linkCode: client.linkCode ?? undefined });
      } catch (e) {
        results.push({ row: i + 1, name: row.name, ok: false, error: e instanceof Error ? e.message : "failed" });
      }
    }
    return {
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
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
