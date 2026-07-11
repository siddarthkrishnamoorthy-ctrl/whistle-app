import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateSettingsDto } from "./dto/update-settings.dto";

interface AcademySettingsShape {
  policies?: Record<string, unknown>;
  paymentGateways?: Record<string, unknown>;
  lessonPlanAssignmentMode?: "calendar" | "grade_sequence";
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Lightweight, safe-for-every-role slice of the academy (2026-07): the
  // tenant's display branding — name, logo, font — shown top-right in the
  // admin console, coach app and parent app. Deliberately excludes settings
  // (payment gateways etc.), which stay admin-only on GET /settings.
  async branding(academyId: string) {
    const academy = await this.prisma.academy.findUnique({
      where: { id: academyId },
      select: { id: true, name: true, brandTheme: true },
    });
    if (!academy) throw new NotFoundException("Academy not found.");
    return academy;
  }

  async get(academyId: string) {
    const academy = await this.prisma.academy.findUnique({
      where: { id: academyId },
      include: { centers: true },
    });
    if (!academy) throw new NotFoundException("Academy not found.");
    return academy;
  }

  async update(academyId: string, dto: UpdateSettingsDto) {
    const academy = await this.prisma.academy.findUniqueOrThrow({ where: { id: academyId } });
    const currentSettings = (academy.settings as AcademySettingsShape | null) ?? {};
    const { policies, lessonPlanAssignmentMode, ...rest } = dto;

    const settingsChanged = policies || lessonPlanAssignmentMode;
    return this.prisma.academy.update({
      where: { id: academyId },
      data: {
        ...rest,
        settings: settingsChanged
          ? ({
              ...currentSettings,
              ...(policies ? { policies: { ...currentSettings.policies, ...policies } } : {}),
              ...(lessonPlanAssignmentMode ? { lessonPlanAssignmentMode } : {}),
            } as object)
          : undefined,
      },
    });
  }
}
