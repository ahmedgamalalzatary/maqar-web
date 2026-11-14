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
    case 'booking': {
      const when = `${fmtDate(body.date, lang)} ${fmtTime(body.time, lang)}`;
      switch (body.state) {
        case 'pending':
          return ar ? `🗓️ العميل حجز معاينة: ${when}، مستنية التأكيد` : `🗓️ Viewing booked: ${when}, awaiting confirmation`;
        case 'moved':
          return ar ? `🔁 المعاينة اتنقلت لـ ${when}` : `🔁 Viewing moved to ${when}`;
        case 'declined':
          return ar ? '❌ المسؤول اعتذر عن المعاينة' : '❌ The advisor declined the viewing';
        case 'cancelled':
          return ar ? '❌ المعاينة اتلغت' : '❌ Viewing cancelled';
        default:
          return ar ? `✅ المعاينة اتأكدت: ${when}` : `✅ Viewing confirmed: ${when}`;
      }
    }
  }
}
