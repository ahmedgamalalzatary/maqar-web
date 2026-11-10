import type { ChatBody } from './api.js';
import type { Lang } from './enums.js';
import { fmtDate, fmtTime } from './format.js';

/** One line for the chat list and the notification: the text, or what the card is. */
export function chatPreview(body: ChatBody, lang: Lang): string {
  const ar = lang === 'ar';
  switch (body.kind) {
    case 'text':
      return body.text;
    case 'images':
      return body.urls.length > 1 ? (ar ? `📷 ${body.urls.length} صور` : `📷 ${body.urls.length} photos`) : ar ? '📷 صورة' : '📷 Photo';
    case 'property':
      return ar ? '🏠 تفاصيل الوحدة' : '🏠 Home details';
    case 'plan':
      return ar ? '🧮 خطة السداد' : '🧮 Payment plan';
    case 'tour':
      return ar ? '🔄 جولة ٣٦٠°' : '🔄 360° tour';
    case 'slots':
      return ar ? `🗓️ مواعيد معاينة ${fmtDate(body.date, 'ar')}` : `🗓️ Viewing times, ${fmtDate(body.date, 'en')}`;
    case 'booking':
      return ar ? `✅ المعاينة اتأكدت: ${fmtDate(body.date, 'ar')} ${fmtTime(body.time, 'ar')}` : `✅ Viewing confirmed: ${fmtDate(body.date, 'en')} ${fmtTime(body.time, 'en')}`;
  }
}
