import { ForbiddenException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Tenant-level student allowance (2026-07): Whistle sells the platform per
// student. When the operator sets allowanceMode "hard" the N+1th student is
// blocked at EVERY creation path (direct add, CSV bulk import, enquiry
// conversion — all funnel through the two callers of this guard). "true_up"
// tenants are never blocked; their real count is billed at period close.
export async function assertTenantCapacity(db: Db, academyId: string): Promise<void> {
  const academy = await db.academy.findUnique({
    where: { id: academyId },
    select: {
      name: true,
      studentAllowance: true,
      allowanceMode: true,
      platformSubscription: { select: { declaredStrength: true } },
    },
  });
  if (!academy || academy.allowanceMode !== "hard") return;

  // Explicit operator-set allowance wins; otherwise fall back to the strength
  // the tenant declared when subscribing.
  const allowance = academy.studentAllowance ?? academy.platformSubscription?.declaredStrength ?? null;
  if (allowance == null) return;

  const students = await db.client.count({ where: { academyId } });
  if (students >= allowance) {
    throw new ForbiddenException(
      `${academy.name} has reached its ${allowance}-student allowance on Whistle — contact Whistle to increase it.`
    );
  }
}
