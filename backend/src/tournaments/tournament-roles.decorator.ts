import { SetMetadata } from "@nestjs/common";
import { ROLES_KEY } from "../common/decorators/roles.decorator";

// The Tournament module has its own user master with roles outside the
// academy UserRole enum ("t_organizer" | "t_official" | "t_registrant").
// Same metadata key so the shared RolesGuard enforces them unchanged.
export type TournamentRole = "t_organizer" | "t_official" | "t_registrant";
export const TournamentRoles = (...roles: TournamentRole[]) => SetMetadata(ROLES_KEY, roles);
