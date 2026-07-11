import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateLinkCode } from "../common/prisma-selects";
import { assertTenantCapacity } from "../common/tenant-allowance";
import type { CreateEnquiryDto } from "./dto/create-enquiry.dto";
import type { UpdateEnquiryDto } from "./dto/update-enquiry.dto";
import type { ConvertEnquiryDto } from "./dto/convert-enquiry.dto";

interface ActivityEntry {
  text: string;
  at: string;
  by?: string;
}

function addToDate(date: Date, value: number, unit: string): Date {
  const result = new Date(date);
  if (unit === "day") result.setDate(result.getDate() + value);
  else if (unit === "week") result.setDate(result.getDate() + value * 7);
  else if (unit === "year") result.setFullYear(result.getFullYear() + value);
  else result.setMonth(result.getMonth() + value); // default: month
  return result;
}

@Injectable()
export class EnquiriesService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string, stage?: string) {
    return this.prisma.enquiry.findMany({
      where: { academyId, ...(stage ? { stage: stage as never } : {}) },
      include: { sport: true, assignedStaff: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findOneOrThrow(academyId: string, id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: { sport: true, assignedStaff: { select: { id: true, name: true } } },
    });
    if (!enquiry) throw new NotFoundException("Enquiry not found.");
    if (enquiry.academyId !== academyId) throw new ForbiddenException();
    return enquiry;
  }

  create(academyId: string, dto: CreateEnquiryDto, createdBy: string) {
    const activityLog: ActivityEntry[] = [{ text: "Enquiry created", at: new Date().toISOString(), by: createdBy }];
    return this.prisma.enquiry.create({
      data: { ...dto, academyId, activityLog: activityLog as unknown as object },
    });
  }

  async update(academyId: string, id: string, dto: UpdateEnquiryDto) {
    const existing = await this.findOneOrThrow(academyId, id);
    const log = (existing.activityLog as unknown as ActivityEntry[]) ?? [];
    if (dto.status && dto.status !== existing.status) {
      log.push({ text: `Status changed to ${dto.status}`, at: new Date().toISOString() });
    }
    if (dto.stage && dto.stage !== existing.stage) {
      log.push({ text: `Moved to ${dto.stage}`, at: new Date().toISOString() });
    }
    if (dto.note && dto.note !== existing.note) {
      log.push({ text: "Note updated", at: new Date().toISOString() });
    }
    return this.prisma.enquiry.update({
      where: { id },
      data: { ...dto, activityLog: log as unknown as object },
    });
  }

  async convertToClient(academyId: string, id: string, dto: ConvertEnquiryDto) {
    const enquiry = await this.findOneOrThrow(academyId, id);

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || plan.academyId !== academyId) throw new ForbiddenException("Plan not in this academy.");
    const klass = await this.prisma.class.findUnique({ where: { id: dto.classId }, include: { center: true } });
    if (!klass || klass.center.academyId !== academyId) throw new ForbiddenException("Class not in this academy.");

    const startDate = new Date();
    const endDate = addToDate(startDate, plan.durationValue ?? 1, plan.durationUnit ?? "month");
    const log = (enquiry.activityLog as unknown as ActivityEntry[]) ?? [];
    log.push({ text: `Converted to client on ${plan.title}`, at: new Date().toISOString() });

    // School student allowance (2026-07): same cap as direct student
    // creation — conversion cannot sneak a student past the school's limit.
    if (klass.schoolId) {
      const school = await this.prisma.school.findUnique({
        where: { id: klass.schoolId },
        select: { name: true, maxStudents: true },
      });
      if (school?.maxStudents != null) {
        const enrolled = await this.prisma.enrollment.findMany({
          where: { status: "active", class: { schoolId: klass.schoolId } },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        if (enrolled.length >= school.maxStudents) {
          throw new ForbiddenException(
            `${school.name} has reached its ${school.maxStudents}-student allowance — upgrade the school's access to enroll more.`
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Tenant-level allowance — conversion is a student-creation path too.
      await assertTenantCapacity(tx, academyId);

      const client = await tx.client.create({
        data: {
          academyId,
          centerId: enquiry.centerId,
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone,
          gender: enquiry.gender,
          dob: enquiry.birthday,
          linkCode: generateLinkCode(),
        },
      });
      await tx.enrollment.create({
        data: {
          clientId: client.id,
          planId: plan.id,
          classId: klass.id,
          startDate,
          endDate,
          sessionsLeft: plan.sessionsIncluded,
          status: "active",
        },
      });
      await tx.enquiry.update({
        where: { id },
        data: { stage: "closed", convertedClientId: client.id, activityLog: log as unknown as object },
      });
      return client;
    });
  }
}
