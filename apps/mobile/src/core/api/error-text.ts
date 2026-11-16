import { m, useT } from '@/core/i18n';
import { ApiError } from './api';

/**
 * What a failed request means, in the user's language: the server's own reason when it has one
 * (the API's messages are actionable), else a fair guess from the status — never a blame on
 * valid input for a server failure.
 */
export function errorText(e: unknown, t: ReturnType<typeof useT>): string {
  if (!(e instanceof ApiError)) return t(m.common.somethingWentWrongTryAgain);
  if (e.status === 0) return t(m.common.cantReachTheServerTry);
  if (e.message && e.status !== 401) return e.message;
  if (e.status === 401 || e.status === 403) return t(m.common.yourSessionEndedOrYou);
  if (e.status === 429) return t(m.common.tooManyAttemptsWaitA);
  return t(m.common.somethingWentWrongTryAgain);
}
