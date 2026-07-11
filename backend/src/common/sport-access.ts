import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Owner-granted sport access (2026-07): Whistle decides which sports each
// tenant gets. Returns the tenant's allow-list, or null when unrestricted
// (no academy — e.g. the platform owner — or an empty grant, which means
// "all sports" so pre-existing tenants keep working).
export async function allowedSportsFor(db: Db, academyId: string | null | undefined): Promise<string[] | null> {
  if (!academyId) return null;
  const academy = await db.academy.findUnique({
    where: { id: academyId },
    select: { allowedSports: true },
  });
  if (!academy || academy.allowedSports.length === 0) return null;
  return academy.allowedSports;
}
