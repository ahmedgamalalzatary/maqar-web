import type { Bi } from '@maqar/shared';
import { ApiError } from '@/core/api/api';

/** A friendly message for a failed sign-in or sign-up, in both languages. */
export function authErrorMessage(err: unknown): Bi {
  if (err instanceof ApiError) {
    if (err.status === 0) return { ar: 'مش قادرين نوصل للخادم، اتأكد من النت.', en: "Can't reach the server. Check your connection." };
    if (err.status === 401) return { ar: 'الإيميل أو كلمة السر غلط', en: 'Wrong email or password' };
    if (err.status === 409) return { ar: 'الإيميل ده عليه حساب بالفعل', en: 'This email already has an account' };
    if (err.status === 429) return { ar: 'محاولات كتير، استنى دقيقة وجرّب تاني', en: 'Too many attempts. Wait a minute and try again.' };
    if (err.status === 400)
      return {
        ar: 'اتأكد من البيانات: إيميل صحيح، وكلمة سر ٨ حروف على الأقل فيها حرف ورقم.',
        en: 'Check your details: a valid email, and a password of 8+ characters with a letter and a digit.',
      };
  }
  return { ar: 'حصل خطأ، جرّب تاني', en: 'Something went wrong. Try again.' };
}
