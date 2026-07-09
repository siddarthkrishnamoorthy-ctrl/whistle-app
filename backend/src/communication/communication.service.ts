import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SAFE_USER_SELECT } from "../common/prisma-selects";
import type { CreateThreadDto } from "./dto/create-thread.dto";
import type { SendMessageDto } from "./dto/send-message.dto";
import type { CreateNoticeDto } from "./dto/create-notice.dto";
import type { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";

interface WhatsappSettingsShape {
  automatedReminders?: boolean;
  invoiceGenerationAlerts?: boolean;
  classCancellationNotices?: boolean;
}

interface AcademySettingsShape {
  policies?: Record<string, unknown>;
  paymentGateways?: Record<string, unknown>;
  whatsapp?: WhatsappSettingsShape;
}

const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettingsShape = {
  automatedReminders: false,
  invoiceGenerationAlerts: false,
  classCancellationNotices: false,
};

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  members(academyId: string, excludeUserId: string) {
    return this.prisma.user.findMany({
      where: { academyId, id: { not: excludeUserId } },
      select: SAFE_USER_SELECT,
      orderBy: { name: "asc" },
    });
  }

  async threads(academyId: string, userId: string) {
    const threads = await this.prisma.chatThread.findMany({
      where: { academyId, members: { some: { userId } } },
      include: {
        members: { include: { user: { select: SAFE_USER_SELECT } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return threads.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      members: t.members.map((m) => m.user),
      lastMessage: t.messages[0] ?? null,
    }));
  }

  async createThread(academyId: string, creatorId: string, dto: CreateThreadDto) {
    const memberIds = Array.from(new Set([...dto.memberIds, creatorId]));
    const members = await this.prisma.user.findMany({ where: { id: { in: memberIds }, academyId } });
    if (members.length !== memberIds.length) throw new ForbiddenException("Members must be in this academy.");

    return this.prisma.chatThread.create({
      data: {
        academyId,
        type: dto.type,
        name: dto.name,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: SAFE_USER_SELECT } } } },
    });
  }

  private async findThreadOrThrow(academyId: string, threadId: string, userId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: { members: true },
    });
    if (!thread || thread.academyId !== academyId) throw new NotFoundException("Thread not found.");
    if (!thread.members.some((m) => m.userId === userId)) throw new ForbiddenException();
    return thread;
  }

  async messages(academyId: string, threadId: string, userId: string) {
    await this.findThreadOrThrow(academyId, threadId, userId);
    return this.prisma.chatMessage.findMany({
      where: { threadId },
      include: { sender: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendMessage(academyId: string, threadId: string, userId: string, dto: SendMessageDto) {
    await this.findThreadOrThrow(academyId, threadId, userId);
    return this.prisma.chatMessage.create({
      data: { threadId, senderId: userId, body: dto.body },
      include: { sender: { select: SAFE_USER_SELECT } },
    });
  }

  notices(academyId: string) {
    return this.prisma.noticeBoardPost.findMany({
      where: { academyId },
      include: { author: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: "desc" },
    });
  }

  createNotice(academyId: string, createdBy: string, dto: CreateNoticeDto) {
    return this.prisma.noticeBoardPost.create({
      data: { academyId, createdBy, title: dto.title, content: dto.content },
      include: { author: { select: SAFE_USER_SELECT } },
    });
  }

  async whatsappSettings(academyId: string): Promise<WhatsappSettingsShape> {
    const academy = await this.prisma.academy.findUniqueOrThrow({ where: { id: academyId } });
    const settings = (academy.settings as AcademySettingsShape | null) ?? {};
    return { ...DEFAULT_WHATSAPP_SETTINGS, ...settings.whatsapp };
  }

  async updateWhatsappSettings(academyId: string, dto: UpdateWhatsappSettingsDto) {
    const academy = await this.prisma.academy.findUniqueOrThrow({ where: { id: academyId } });
    const currentSettings = (academy.settings as AcademySettingsShape | null) ?? {};
    const whatsapp = { ...DEFAULT_WHATSAPP_SETTINGS, ...currentSettings.whatsapp, ...dto };
    await this.prisma.academy.update({
      where: { id: academyId },
      data: { settings: { ...currentSettings, whatsapp } as object },
    });
    return whatsapp;
  }
}
