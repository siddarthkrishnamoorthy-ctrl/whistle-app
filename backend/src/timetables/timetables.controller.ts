import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TimetablesService } from "./timetables.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("timetables")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
// account_manager included (2026-07): AMs run their school's operations —
// uploading the term timetable is theirs (same rationale as classes/students).
@Roles("admin", "account_manager")
export class TimetablesController {
  constructor(private timetablesService: TimetablesService) {}

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.timetablesService.findOneOrThrow(user.academyId as string, id);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("termLabel") termLabel?: string
  ) {
    if (!file) throw new BadRequestException("No file uploaded.");
    return this.timetablesService.upload(user.academyId as string, user.sub, file.buffer, termLabel);
  }

  @Post(":id/commit")
  commit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.timetablesService.commit(user.academyId as string, id);
  }
}
