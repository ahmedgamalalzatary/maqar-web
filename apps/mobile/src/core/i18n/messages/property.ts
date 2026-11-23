import { count, fmtMoney, type Bi } from '@mqr/shared';
import type { Message } from './types';
import { FORMS, counted, arNum } from './forms';

export const property = {
  aboutThisHome: { ar: 'عن الوحدة', en: 'About this home' },
  baths: { ar: 'حمام', en: 'Baths' },
  beds: { ar: 'غرف', en: 'Beds' },
  closeTheVideo: { ar: 'اقفل الفيديو', en: 'Close the video' },
  listedToday: { ar: 'اتعرضت النهارده', en: 'Listed today' },
  onMqr: { ar: 'على مقر', en: 'On MQR' },
  share: { ar: 'مشاركة', en: 'Share' },
  similarHomes: { ar: 'وحدات مشابهة', en: 'Similar homes' },
  thisHomeIsNoLonger: { ar: 'الوحدة دي مش متاحة دلوقتي.', en: 'This home is no longer available.' },
  tryADownPaymentAnd: { ar: 'جرّب مقدم ومدة تناسبك.', en: 'Try a down payment and period that suit you.' },
  yourInstallment: { ar: 'احسب قسطك', en: 'Your installment' },
  yourSalesAdvisorForThis: { ar: 'مسؤول المبيعات للوحدة دي', en: 'Your sales advisor for this home' },
  deals: (n: number): Bi => counted(n, FORMS.deal),
  aimsToReply: (mins: number): Bi => ({ ar: `هدفنا الرد خلال ${arNum(mins)} د`, en: `aims to reply in ${mins}m` }),
  openPhoto: (n: number, total: number): Bi => ({ ar: `افتح صورة ${arNum(n)} من ${arNum(total)}`, en: `Open photo ${n} of ${total}` }),
  videosPlayFirst: (n: number): Bi => ({ ar: `${count(n, FORMS.video, 'ar')}، شغّل الأول`, en: `${count(n, FORMS.video, 'en')}, play the first` }),
  pctLower: (pct: number): Bi => ({ ar: `نزل ${arNum(pct)}٪`, en: `${pct}% lower` }),
  perM2: (amount: number): Bi => ({ ar: `${fmtMoney(amount, 'ar', false)} للمتر`, en: `${fmtMoney(amount, 'en', false)} per m²` }),
  listedAgo: (days: number): Bi => ({ ar: `اتعرضت من ${count(days, FORMS.day, 'ar')}`, en: `Listed ${count(days, FORMS.day, 'en')} ago` }),
  planNote: (downPct: number, years: number): Bi => ({
    ar: `خطة الوحدة: مقدم ${arNum(downPct)}٪ على ${count(years, FORMS.year, 'ar')}. غيّرها براحتك.`,
    en: `This home’s plan: ${downPct}% down over ${count(years, FORMS.year, 'en')}. Adjust freely.`,
  }),
  maintenance: (pct: number): Bi => ({ ar: `مصاريف الصيانة: ${arNum(pct)}٪ من سعر الوحدة`, en: `Maintenance: ${pct}% of the unit price` }),
} satisfies Record<string, Message>;
