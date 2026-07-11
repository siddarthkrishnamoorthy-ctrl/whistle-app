import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { batch: true } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.academyId !== academyId) throw new ForbiddenException();
    // An invoice awaiting settlement through a batch is paid via the batch's
    // single consolidated payment — individual pay would double-collect.
    if (invoice.batch && invoice.batch.status === "pending") {
      throw new BadRequestException(
        `This invoice is part of batch "${invoice.batch.title}" — settle it with the batch's single payment.`
      );
    }
    return this.prisma.invoice.update({ where: { id }, data: { status: "paid" } });
  }

  // ── Invoice batches (2026-07): bulk payment ───────────────────────────────
  // Select N pending student invoices → one consolidated payable → one
  // payment marks every member invoice paid (term collection, sponsor paying
  // for a squad, a parent settling siblings in one go).

  listBatches(academyId: string) {
    return this.prisma.invoiceBatch.findMany({
      where: { academyId },
      include: {
        invoices: {
          select: { id: true, invoiceNumber: true, amount: true, status: true, client: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createBatch(academyId: string, dto: { invoiceIds: string[]; title?: string; payerName?: string }) {
    const ids = [...new Set(dto.invoiceIds ?? [])];
    if (ids.length < 2) throw new BadRequestException("Pick at least two invoices to batch.");

    return this.prisma.$transaction(async (tx) => {
      const invoices = await tx.invoice.findMany({ where: { id: { in: ids } }, include: { batch: true } });
      if (invoices.length !== ids.length) throw new NotFoundException("One or more invoices were not found.");
      for (const inv of invoices) {
        if (inv.academyId !== academyId) throw new ForbiddenException("Invoice not in this academy.");
        if (inv.status !== "pending") throw new BadRequestException(`${inv.invoiceNumber} is already paid.`);
        if (inv.batch && inv.batch.status === "pending") {
          throw new BadRequestException(`${inv.invoiceNumber} is already in batch "${inv.batch.title}".`);
        }
      }
      const totalAmount = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
      const batch = await tx.invoiceBatch.create({
        data: {
          academyId,
          title: dto.title?.trim() || `Bulk payment · ${invoices.length} invoices`,
          payerName: dto.payerName?.trim() || null,
          totalAmount,
        },
      });
      await tx.invoice.updateMany({ where: { id: { in: ids } }, data: { batchId: batch.id } });
      return tx.invoiceBatch.findUnique({ where: { id: batch.id }, include: { invoices: true } });
    });
  }

  async payBatch(academyId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.invoiceBatch.findUnique({ where: { id }, include: { invoices: true } });
      if (!batch) throw new NotFoundException("Batch not found.");
      if (batch.academyId !== academyId) throw new ForbiddenException();
      if (batch.status === "paid") throw new BadRequestException("Batch is already paid.");
      await tx.invoice.updateMany({ where: { batchId: id }, data: { status: "paid" } });
      return tx.invoiceBatch.update({
        where: { id },
        data: { status: "paid", paidAt: new Date() },
        include: { invoices: true },
      });
    });
  }

  // Dissolving a pending batch frees its invoices for individual payment.
  async deleteBatch(academyId: string, id: string) {
    const batch = await this.prisma.invoiceBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException("Batch not found.");
    if (batch.academyId !== academyId) throw new ForbiddenException();
    if (batch.status === "paid") throw new BadRequestException("A settled batch is a payment record — it can't be deleted.");
    await this.prisma.$transaction([
      this.prisma.invoice.updateMany({ where: { batchId: id }, data: { batchId: null } }),
      this.prisma.invoiceBatch.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
