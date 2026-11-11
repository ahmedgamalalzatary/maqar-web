import { applyDecorators, Injectable, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from './decorators/current-user.decorator.js';

/** Writes a signed-in account may make per minute (60s window), per user. */
export const WRITE_LIMIT = { default: { limit: 60, ttl: 60_000 } } as const;

/**
 * Counts writes per account, not per address: many clients share one address (a carrier's NAT,
 * an office Wi-Fi), and nginx already limits each address. The access-token guard runs first, so
 * the user is known; a request without one falls back to its address.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as AuthUser | undefined;
    return user ? Promise.resolve(`user:${user.id}`) : super.getTracker(req);
  }
}

/**
 * Rate limits the abuse-prone write routes (contract §15): chat messages and photos, bookings,
 * uploads, notification requests, saves and price follows. The auth controller keeps its own
 * stricter, per-IP limit; public reads stay unlimited.
 */
export const RateLimited = (): MethodDecorator & ClassDecorator =>
  applyDecorators(UseGuards(AccountThrottlerGuard), Throttle(WRITE_LIMIT));
