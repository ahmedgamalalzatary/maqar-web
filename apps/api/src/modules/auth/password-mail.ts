import { type Lang, RESET_CODE_MINUTES } from '@mqr/shared';
import type { MailMessage } from '../../core/mail/mailer.js';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A plain, right-to-left-aware email body: the lines as paragraphs, the code (if any) large. */
function page(lang: Lang, lines: string[], code?: string): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const body = lines.map((l) => `<p style="margin:0 0 12px">${escape(l)}</p>`).join('');
  const big = code ? `<p dir="ltr" style="margin:16px 0;font-size:28px;font-weight:700;letter-spacing:6px;color:#041525">${code}</p>` : '';
  return `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d2433">${body}${big}</div>`;
}

/** The code to set a new password (phase 31), in the account's language. */
export function resetCodeMail(to: string, lang: Lang, name: string, code: string): MailMessage {
  if (lang === 'ar') {
    const lines = [`أهلًا ${name}،`, 'ده كود تغيير كلمة السر لحسابك في مقر:', `الكود شغال ${RESET_CODE_MINUTES} دقيقة. لو مش إنت اللي طلبته، سيب الإيميل ده وكلمة السر هتفضل زي ما هي.`];
    return { to, subject: 'كود تغيير كلمة السر في مقر', text: `${lines[0]}\n${lines[1]}\n\n${code}\n\n${lines[2]}`, html: page(lang, lines.slice(0, 2), code) + page(lang, lines.slice(2)) };
  }
  const lines = [`Hello ${name},`, 'Here is the code to set a new password for your MQR account:', `It works for ${RESET_CODE_MINUTES} minutes. If you didn't ask for it, ignore this email and your password stays as it is.`];
  return { to, subject: 'Your MQR password code', text: `${lines[0]}\n${lines[1]}\n\n${code}\n\n${lines[2]}`, html: page(lang, lines.slice(0, 2), code) + page(lang, lines.slice(2)) };
}

/** An advisor asked for a code: their password is reset by the admin (owner's call). */
export function staffResetMail(to: string, lang: Lang, name: string): MailMessage {
  const lines =
    lang === 'ar'
      ? [`أهلًا ${name}،`, 'حد طلب تغيير كلمة السر لحسابك في مقر.', 'كلمة سر حسابات المسؤولين بتتغير من الإدارة: كلّم الإدارة وهي هتعملك كلمة سر جديدة.', 'لو مش إنت اللي طلبت، سيب الإيميل ده.']
      : [`Hello ${name},`, 'Someone asked to reset the password of your MQR account.', "Advisors' passwords are set by the admin: ask the admin for a new one.", "If you didn't ask, ignore this email."];
  return { to, subject: lang === 'ar' ? 'تغيير كلمة السر في مقر' : 'Your MQR password', text: lines.join('\n'), html: page(lang, lines) };
}
