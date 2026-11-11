// Number, money, percent, date and time formatting (contract §7).
//
// Written by hand instead of with Intl: Hermes (the app's JS engine) has gaps in
// Intl (compact notation, RelativeTimeFormat), and the output must be identical
// on the API, on both phone platforms and under tests.

import type { Lang } from './enums.js';
import type { Bi } from './labels.js';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Use instead of "·" or "•", which read as zero next to Arabic digits. */
export const SEP = ' | ';

/** Pick the right language from a `Bi` value. */
export function pick(bi: Bi, lang: Lang): string {
  return bi[lang];
}

/** Latin digits → Arabic-Indic digits when the language is Arabic. */
export function localDigits(s: string, lang: Lang): string {
  return lang === 'ar' ? s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]!) : s;
}

/** 1234567.5 → "١٬٢٣٤٬٥٦٧٫٥" / "1,234,567.5" */
export function fmtNum(n: number, lang: Lang, maxFrac = 2): string {
  const [int = '0', rawFrac = ''] = Math.abs(n).toFixed(maxFrac).split('.');
  const frac = rawFrac.replace(/0+$/, '');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'ar' ? '٬' : ',');
  const dec = frac ? (lang === 'ar' ? '٫' : '.') + frac : '';
  // A value that rounds to zero has no sign.
  const sign = n < 0 && (Number(int) > 0 || frac) ? '-' : '';
  return localDigits(sign + grouped + dec, lang);
}

const COMPACT = [
  { at: 1e9, ar: 'مليار', en: 'B' },
  { at: 1e6, ar: 'مليون', en: 'M' },
  { at: 1e3, ar: 'ألف', en: 'K' },
];

/** 11_200_000 → "١١٫٢ مليون" / "11.2M"; 500_000 → "٥٠٠ ألف" / "500K" */
export function fmtCompact(n: number, lang: Lang): string {
  const abs = Math.abs(n);
  const i = COMPACT.findIndex((u) => abs >= u.at);
  const unit = COMPACT[i];
  if (!unit) return fmtNum(n, lang);
  const maxFrac = unit.at >= 1e6 ? 2 : 0;
  const v = Number((abs / unit.at).toFixed(maxFrac));
  // 999_999 would round to "1000K"; show it in the next unit up instead.
  const bigger = COMPACT[i - 1];
  if (v >= 1000 && bigger) return fmtCompact(Math.sign(n) * bigger.at, lang);
  const num = fmtNum(Math.sign(n) * v, lang, maxFrac);
  return lang === 'ar' ? `${num} ${unit.ar}` : `${num}${unit.en}`;
}

/** Whole EGP. Compact from 100,000 up: "١١٫٢ مليون ج.م" / "EGP 11.2M". */
export function fmtMoney(n: number, lang: Lang, compact = true): string {
  const v = compact && Math.abs(n) >= 100_000 ? fmtCompact(n, lang) : fmtNum(n, lang, 0);
  return lang === 'ar' ? `${v} ج.م` : `EGP ${v}`;
}

/** 5 → "٥٪" / "5%". A negative value reads as a drop: "٦٪-" / "-6%". */
export function fmtPct(n: number, lang: Lang, maxFrac = 1): string {
  const v = fmtNum(Math.abs(n), lang, maxFrac);
  // A drop that rounds to zero is shown as zero, with no sign (like fmtNum).
  const minus = n < 0 && Number(Math.abs(n).toFixed(maxFrac)) > 0 ? '-' : '';
  return lang === 'ar' ? `${v}٪${minus}` : `${minus}${v}%`;
}

/** "16:00" → "٤:٠٠ م" / "4:00 PM" (12-hour with a period word). */
export function fmtTime(hhmm: string, lang: Lang): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const clock = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  const am = h < 12;
  const period = lang === 'ar' ? (am ? 'ص' : 'م') : am ? 'AM' : 'PM';
  return `${localDigits(clock, lang)} ${period}`;
}

const MONTHS: Record<Lang, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const WEEKDAYS: Record<Lang, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/** The name of a weekday, 0 = Sunday. */
export const weekdayName = (weekday: number, lang: Lang): string => WEEKDAYS[lang][weekday] ?? '';

export type DateStyle = 'dayMonth' | 'full' | 'long' | 'weekday' | 'monthYear';

/** "2026-11-12" is a local calendar day, not UTC midnight. */
function toDate(d: Date | string | number): Date {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y = 0, m = 1, day = 1] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return d instanceof Date ? d : new Date(d);
}

/**
 * dayMonth:  "١٢ نوفمبر" / "12 Nov"
 * full:      "الخميس ١٢ نوفمبر ٢٠٢٦" / "Thursday, 12 November 2026"
 * long:      "الخميس ١٢ نوفمبر" / "Thursday, 12 November"
 * weekday:   "الخميس" / "Thu"
 * monthYear: "نوفمبر ٢٠٢٦" / "November 2026"
 */
export function fmtDate(input: Date | string | number, lang: Lang, style: DateStyle = 'dayMonth'): string {
  const d = toDate(input);
  const day = localDigits(String(d.getDate()), lang);
  const year = localDigits(String(d.getFullYear()), lang);
  const month = MONTHS[lang][d.getMonth()]!;
  const weekday = WEEKDAYS[lang][d.getDay()]!;
  const ar = lang === 'ar';
  switch (style) {
    case 'weekday':
      return ar ? weekday : weekday.slice(0, 3);
    case 'monthYear':
      return `${month} ${year}`;
    case 'full':
      return ar ? `${weekday} ${day} ${month} ${year}` : `${weekday}, ${day} ${month} ${year}`;
    case 'long':
      return ar ? `${weekday} ${day} ${month}` : `${weekday}, ${day} ${month}`;
    default:
      return ar ? `${day} ${month}` : `${day} ${month.slice(0, 3)}`;
  }
}

/** Arabic counted-noun forms: one, two, 3–10, 11 and up. */
type ArForms = [one: string, two: string, few: string, many: string];

const UNITS: { secs: number; ar: ArForms; en: string }[] = [
  { secs: 86_400, ar: ['يوم', 'يومين', 'أيام', 'يوم'], en: 'day' },
  { secs: 3_600, ar: ['ساعة', 'ساعتين', 'ساعات', 'ساعة'], en: 'hour' },
  { secs: 60, ar: ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'], en: 'minute' },
];

function arCount(n: number, [one, two, few, many]: ArForms): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${localDigits(String(n), 'ar')} ${n <= 10 ? few : many}`;
}

/** "قبل ساعتين" / "2 hours ago", "بعد ٣ أيام" / "in 3 days". */
export function relTime(at: Date | number, lang: Lang, now: number = Date.now()): string {
  const t = at instanceof Date ? at.getTime() : at;
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60) return lang === 'ar' ? 'الآن' : 'just now';
  if (abs >= 30 * 86_400) return fmtDate(t, lang);
  const unit = UNITS.find((u) => abs >= u.secs)!;
  // Round down, so 59.98 minutes never shows as "60 minutes".
  const n = Math.floor(abs / unit.secs);
  if (unit.en === 'day' && n === 1) {
    if (lang === 'ar') return past ? 'أمس' : 'غدًا';
    return past ? 'yesterday' : 'tomorrow';
  }
  if (lang === 'ar') return `${past ? 'قبل' : 'بعد'} ${arCount(n, unit.ar)}`;
  const words = `${n} ${unit.en}${n === 1 ? '' : 's'}`;
  return past ? `${words} ago` : `in ${words}`;
}

/**
 * A phone number shown inside text that may be right to left: left-to-right marks keep the
 * leading + in front ("+2010…"), which Arabic layout otherwise moves to the end ("2010…+").
 */
export function ltrPhone(phone: string): string {
  return `‎${phone}‎`;
}
