import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { IS_PUBLIC } from '../../../common/decorators/public.decorator.js';
import { UsersRepository } from '../../users/users.repository.js';

/**
 * Global guard: every route needs a valid access token unless it is @Public().
 * The account is re-read, so a deleted account loses access at once.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token).catch(() => null);
    const sub = payload?.sub;
    const user =
      typeof sub === 'number' && Number.isInteger(sub) ? await this.users.findActiveById(sub) : undefined;
    if (!user) throw new UnauthorizedException();

    req.user = { id: user.id, role: user.role };
    return true;
  }
}
