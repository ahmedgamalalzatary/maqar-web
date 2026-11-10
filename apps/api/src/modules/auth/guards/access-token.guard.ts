import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { IS_PUBLIC } from '../../../common/decorators/public.decorator.js';
import { TokenUsers } from '../token-users.js';

/**
 * Global guard: every route needs a valid access token unless it is @Public().
 * The account is re-read, so a deleted account loses access at once.
 * A public route still reads a valid token, so it can tailor the answer (best match);
 * a missing or bad one there just means a guest.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenUsers,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // The chat socket signs in once, when it connects (ChatGateway); its events have no HTTP request.
    if (ctx.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = await this.userOf(req);
    if (user) req.user = user;
    if (isPublic || user) return true;
    throw new UnauthorizedException();
  }

  private userOf(req: Request): Promise<AuthUser | undefined> {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    return this.tokens.userOf(scheme === 'Bearer' ? token : undefined);
  }
}
