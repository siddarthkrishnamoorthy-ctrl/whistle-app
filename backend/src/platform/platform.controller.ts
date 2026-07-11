import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { PlatformService } from "./platform.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

// Whistle operator console API. NOTE: AcademyRequiredGuard must never be
// applied here — the platform owner has academyId null by design; the
// platform_owner role gate is the whole boundary.
@Controller("platform")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("platform_owner")
export class PlatformController {
  constructor(private service: PlatformService) {}

  @Get("revenue")
  revenue() {
    return this.service.revenue();
  }

  @Get("tenants")
  tenants() {
    return this.service.listTenants();
  }

  @Post("tenants")
  createTenant(
    @Body()
    dto: {
      name: string;
      contactEmail?: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
      declaredStrength?: number;
      studentAllowance?: number;
      allowanceMode?: string;
    }
  ) {
    return this.service.createTenant(dto);
  }

  @Patch("tenants/:id")
  updateTenant(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      studentAllowance?: number | null;
      allowanceMode?: string;
      suspended?: boolean;
      allowedSports?: string[];
      brandTheme?: { displayName?: string; fontKey?: string; logoUrl?: string } | null;
    }
  ) {
    return this.service.updateTenant(id, dto);
  }

  // Tenant logo — stored under the tenant's upload dir and merged straight
  // into their brandTheme so one call does upload + apply.
  @Post("tenants/:id/logo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = join(UPLOAD_ROOT, (req.params as { id: string }).id);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `logo-${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException("Only JPEG, PNG, WEBP, GIF or SVG images are allowed."), false);
          return;
        }
        cb(null, true);
      },
    })
  )
  async uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded.");
    const url = `/uploads/${id}/${file.filename}`;
    await this.service.updateTenant(id, { brandTheme: { logoUrl: url } });
    return { url };
  }

  @Patch("tenants/:id/subscription")
  updateSubscription(
    @Param("id") id: string,
    @Body() dto: { declaredStrength?: number; billingCycle?: string; status?: string }
  ) {
    return this.service.updateSubscription(id, dto);
  }

  @Post("tenants/:id/close-period")
  closePeriod(@Param("id") id: string) {
    return this.service.closePeriod(id);
  }

  @Get("invoices")
  invoices() {
    return this.service.listPlatformInvoices();
  }

  @Post("invoices/:id/mark-paid")
  markInvoicePaid(@Param("id") id: string) {
    return this.service.markPlatformInvoicePaid(id);
  }

  // ── Content library (Whistle-curated drill bank + lesson plans) ───────────

  @Get("drills")
  drills(@Query("sportKey") sportKey?: string) {
    return this.service.listPlatformDrills(sportKey);
  }

  @Post("drills")
  createDrill(
    @Body()
    dto: {
      title: string;
      sportKey: string;
      level?: string;
      durationMin?: number;
      description?: string;
      equipment?: string[];
      videoUrl?: string;
    }
  ) {
    return this.service.createPlatformDrill(dto);
  }

  @Patch("drills/:id")
  updateDrill(
    @Param("id") id: string,
    @Body()
    dto: { title?: string; level?: string; durationMin?: number; description?: string; equipment?: string[]; videoUrl?: string }
  ) {
    return this.service.updatePlatformDrill(id, dto);
  }

  @Delete("drills/:id")
  deleteDrill(@Param("id") id: string) {
    return this.service.deletePlatformDrill(id);
  }

  @Get("lesson-plans")
  lessonPlans(@Query("sportKey") sportKey?: string) {
    return this.service.listPlatformLessonPlans(sportKey);
  }

  @Post("lesson-plans")
  createLessonPlan(
    @Body()
    dto: {
      title: string;
      sportKey: string;
      level?: string;
      goals?: string;
      objectives?: string[];
      targetDurationMin?: number;
      drillIds?: string[];
    }
  ) {
    return this.service.createPlatformLessonPlan(dto);
  }

  @Delete("lesson-plans/:id")
  deleteLessonPlan(@Param("id") id: string) {
    return this.service.deletePlatformLessonPlan(id);
  }

  // ── Shared features: platform-wide tournaments + Match Center ─────────────

  @Get("tournaments")
  tournaments() {
    return this.service.listAllTournaments();
  }

  @Get("events")
  events() {
    return this.service.listAllEvents();
  }

  // ── Assessment test library (owner-curated) ───────────────────────────────

  @Get("assessment-tests")
  assessmentTests() {
    return this.service.listPlatformAssessmentTests();
  }

  @Post("assessment-tests")
  createAssessmentTest(
    @Body()
    dto: {
      name: string;
      category: string;
      metricType: string;
      unit: string;
      precisionDecimals?: number;
      attemptsAllowed?: number;
      instructions?: string;
    }
  ) {
    return this.service.createPlatformAssessmentTest(dto);
  }

  @Delete("assessment-tests/:id")
  deleteAssessmentTest(@Param("id") id: string) {
    return this.service.deletePlatformAssessmentTest(id);
  }

  // ── Cross-academy oversight: CRM + Match Center ───────────────────────────

  @Get("crm")
  crm() {
    return this.service.crm();
  }

  @Get("match-center")
  matchCenter() {
    return this.service.matchCenter();
  }
}
