import { type ArForms, type Bi, count, fmtNum } from '@mqr/shared';

/**
 * Counted nouns (2026-11-16): the Arabic one, two, 3–10 and 0/11+ forms, and the English singular
 * and plural. `counted(n, FORMS.view)` gives "مشاهدتين" / "2 views".
 */
export type Forms = { ar: ArForms; en: [one: string, many: string] };

export const FORMS = {
  view: { ar: ['مشاهدة', 'مشاهدتين', 'مشاهدات', 'مشاهدة'], en: ['view', 'views'] },
  bed: { ar: ['غرفة', 'غرفتين', 'غرف', 'غرفة'], en: ['bed', 'beds'] },
  bedroom: { ar: ['غرفة', 'غرفتين', 'غرف', 'غرفة'], en: ['bedroom', 'bedrooms'] },
  bath: { ar: ['حمام', 'حمامين', 'حمامات', 'حمام'], en: ['bath', 'baths'] },
  room: { ar: ['غرفة واحدة', 'غرفتين', 'غرف', 'غرفة'], en: ['room', 'rooms'] },
  listing: { ar: ['عقار', 'عقارين', 'عقارات', 'عقار'], en: ['listing', 'listings'] },
  liveListing: { ar: ['عقار منشور', 'عقارين منشورين', 'عقارات منشورة', 'عقار منشور'], en: ['live listing', 'live listings'] },
  home: { ar: ['وحدة', 'وحدتين', 'وحدات', 'وحدة'], en: ['home', 'homes'] },
  message: { ar: ['رسالة', 'رسالتين', 'رسائل', 'رسالة'], en: ['message', 'messages'] },
  deal: { ar: ['صفقة', 'صفقتين', 'صفقات', 'صفقة'], en: ['deal', 'deals'] },
  day: { ar: ['يوم', 'يومين', 'أيام', 'يوم'], en: ['day', 'days'] },
  dayOff: { ar: ['يوم إجازة', 'يومين إجازة', 'أيام إجازة', 'يوم إجازة'], en: ['day off', 'days off'] },
  year: { ar: ['سنة', 'سنتين', 'سنين', 'سنة'], en: ['year', 'years'] },
  photo: { ar: ['صورة واحدة', 'صورتين', 'صور', 'صورة'], en: ['photo', 'photos'] },
  video: { ar: ['فيديو واحد', 'فيديوهين', 'فيديوهات', 'فيديو'], en: ['video', 'videos'] },
  freeTime: { ar: ['ميعاد', 'ميعادين', 'مواعيد', 'ميعاد'], en: ['free', 'free'] },
  freeTimeLong: { ar: ['ميعاد فاضي', 'ميعادين فاضيين', 'مواعيد فاضية', 'ميعاد فاضي'], en: ['free', 'free'] },
} satisfies Record<string, Forms>;

/** A counted noun in both languages. */
export const counted = (n: number, forms: Forms): Bi => ({ ar: count(n, forms, 'ar'), en: count(n, forms, 'en') });

/** A number in Arabic digits, for the Arabic side of a message. */
export const arNum = (n: number) => fmtNum(n, 'ar');

/** English singular or plural, for phrases where the number stays in Arabic digits as-is. */
export const enPlural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
