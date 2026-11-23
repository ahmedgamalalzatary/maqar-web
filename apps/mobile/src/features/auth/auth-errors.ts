import type { Bi } from '@mqr/shared';
import { ApiError } from '@/core/api/api';
import { m } from '@/core/i18n';

/** A friendly message for a failed sign-in or sign-up, in both languages. */
export function authErrorMessage(err: unknown): Bi {
  if (err instanceof ApiError) {
    if (err.status === 0) return m.auth.cantReachServer;
    if (err.status === 401) return m.auth.wrongEmailOrPassword;
    if (err.status === 409) return m.auth.thisEmailAlreadyHasAn;
    if (err.status === 429) return m.auth.tooManyAttemptsWaitA;
    if (err.status === 400)
      return m.auth.checkYourDetailsAValid;
  }
  return m.account.somethingWentWrongTryAgain;
}
