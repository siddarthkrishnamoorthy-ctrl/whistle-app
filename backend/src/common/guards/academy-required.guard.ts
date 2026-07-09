import { Injectable, CanActivate, ForbiddenException, type ExecutionContext } from "@nestjs/common";

// Academy Operations endpoints (Plans, Classes, Staff, Drills, ...) all need
// the caller to belong to an academy — parents and not-yet-linked coaches
// don't. Centralizing this check keeps individual controllers from repeating
// `if (!user.academyId) throw ...` on every handler.
@Injectable()
export class AcademyRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.academyId) throw new ForbiddenException("Not attached to an academy.");
    return true;
  }
}
