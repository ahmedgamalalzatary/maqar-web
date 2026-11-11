import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

/** Writes a signed-in account may make per minute (60s window), per user. */
export const WRITE_LIMIT = { default: { limit: 60, ttl: 60_000 } } as const;

/**
 * Rate limits the abuse-prone write routes (contract §15): chat messages and photos, bookings,
 * uploads, notification requests, saves and price follows. The auth controller keeps its own
 * stricter, per-IP limit; public reads stay unlimited.
 */
export const RateLimited = (): MethodDecorator & ClassDecorator =>
  applyDecorators(UseGuards(ThrottlerGuard), Throttle(WRITE_LIMIT));
