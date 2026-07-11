import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

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
    @Body() dto: { name?: string; studentAllowance?: number | null; allowanceMode?: string; suspended?: boolean }
  ) {
    return this.service.updateTenant(id, dto);
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
}
