import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  findAll(academyId: string) {
    return this.prisma.invoice.findMany({
      where: { academyId },
      include: { client: { select: { id: true, name: true } }, plan: { select: { id: true, title: true } } },
      orderBy: { issuedAt: "desc" },
    });
  }

  async summary(academyId: string) {
    const invoices = await this.prisma.invoice.findMany({ where: { academyId } });
    const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const received = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
    return { totalInvoiced, received, outstanding: totalInvoiced - received };
  }

  async create(academyId: string, dto: CreateInvoiceDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || client.academyId !== academyId) throw new ForbiddenException("Client not in this academy.");

    const count = await this.prisma.invoice.count({ where: { academyId } });
    const invoiceNumber = `INV-${(1000 + count + 1).toString()}`;

    return this.prisma.invoice.create({
      data: { academyId, invoiceNumber, clientId: dto.clientId, planId: dto.planId, amount: dto.amount },
    });
  }

  async markPaid(academyId: string, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.academyId !== academyId) throw new ForbiddenException();
    return this.prisma.invoice.update({ where: { id }, data: { status: "paid" } });
  }
}
