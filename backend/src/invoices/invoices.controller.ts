import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

@Controller("invoices")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
@Roles("admin", "account_manager")
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findAll(user.academyId as string);
  }

  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.summary(user.academyId as string);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.academyId as string, dto);
  }

  @Post(":id/mark-paid")
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.invoicesService.markPaid(user.academyId as string, id);
  }
}
