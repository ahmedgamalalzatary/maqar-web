import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@maqar/shared';

/** The signed-in account, set by the access-token guard. */
export type AuthUser = { id: number; role: Role };

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
