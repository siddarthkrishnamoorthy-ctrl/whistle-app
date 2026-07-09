import type { UserRole } from "@prisma/client";

// JWT access-token payload — carries user_id, academy_id, role per TDD
// Section 8 ("Role claim"). academyId is null for parent/student accounts
// not yet linked to an academy.
export interface JwtPayload {
  sub: string;
  role: UserRole;
  academyId: string | null;
}

export type AuthenticatedUser = JwtPayload;
