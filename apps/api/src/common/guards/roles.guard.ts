import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@maqar/shared';
import type { AuthUser } from '../decorators/current-user.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Runs after the access-token guard. Routes without @Roles() are open to any signed-in role. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Socket events are checked by the gateway itself (only clients and agents connect).
    if (ctx.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user && roles.includes(user.role)) return true;
    throw new ForbiddenException('Your account cannot do this');
  }
}
