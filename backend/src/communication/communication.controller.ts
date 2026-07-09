import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CommunicationService } from "./communication.service";
import { CreateThreadDto } from "./dto/create-thread.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("communication")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager", "venue_manager", "head_coach", "coach")
export class CommunicationController {
  constructor(private communicationService: CommunicationService) {}

  @Get("members")
  members(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationService.members(user.academyId as string, user.sub);
  }

  // Parents can read and reply in threads they're members of (the service
  // already scopes by membership) — this is how renewal reminders reach them.
  @Get("threads")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "parent")
  threads(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationService.threads(user.academyId as string, user.sub);
  }

  @Post("threads")
  createThread(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThreadDto) {
    return this.communicationService.createThread(user.academyId as string, user.sub, dto);
  }

  @Get("threads/:id/messages")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "parent")
  messages(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.communicationService.messages(user.academyId as string, id, user.sub);
  }

  @Post("threads/:id/messages")
  @Roles("admin", "account_manager", "venue_manager", "head_coach", "coach", "parent")
  sendMessage(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SendMessageDto) {
    return this.communicationService.sendMessage(user.academyId as string, id, user.sub, dto);
  }

  @Get("notices")
  notices(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationService.notices(user.academyId as string);
  }

  @Post("notices")
  @Roles("admin", "account_manager", "venue_manager", "head_coach")
  createNotice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNoticeDto) {
    return this.communicationService.createNotice(user.academyId as string, user.sub, dto);
  }

  @Get("whatsapp-settings")
  @Roles("admin", "account_manager")
  whatsappSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationService.whatsappSettings(user.academyId as string);
  }

  @Patch("whatsapp-settings")
  @Roles("admin", "account_manager")
  updateWhatsappSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWhatsappSettingsDto) {
    return this.communicationService.updateWhatsappSettings(user.academyId as string, dto);
  }
}
