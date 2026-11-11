import { useT } from '@/core/i18n';
import { ApiError } from './api';

/**
 * What a failed request means, in the user's language: the server's own reason when it has one
 * (the API's messages are actionable), else a fair guess from the status — never a blame on
 * valid input for a server failure.
 */
export function errorText(e: unknown, t: ReturnType<typeof useT>): string {
  if (!(e instanceof ApiError)) return t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again');
  if (e.status === 0) return t('مفيش اتصال بالسيرفر، حاول تاني', 'Can’t reach the server, try again');
  if (e.message && e.status !== 401) return e.message;
  if (e.status === 401 || e.status === 403) return t('الجلسة خلصت أو ماعندكش صلاحية', 'Your session ended or you don’t have permission');
  if (e.status === 429) return t('محاولات كتير، استنى شوية وجرب تاني', 'Too many attempts, wait a moment and try again');
  return t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again');
}
