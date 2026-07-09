import { randomBytes } from "crypto";

// Reusable Prisma `select`/`include` fragments that leave passwordHash out.
// `include: { user: true }` (or any nested equivalent) pulls every column on
// User, including passwordHash — every place that surfaces a coach/staff
// member on an API response must go through one of these instead.

export function generateLinkCode(): string {
  return `WHSL-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export const SAFE_USER_SELECT = {
  id: true,
  academyId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

export const SAFE_COACH_INCLUDE = {
  include: { user: { select: SAFE_USER_SELECT } },
} as const;
