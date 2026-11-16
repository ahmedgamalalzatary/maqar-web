import { fmtMoney, type Bi } from '@maqar/shared';
import type { Message } from './types';
import { arNum } from './forms';

export const home = {
  allPicks: { ar: 'كل الترشيحات', en: 'All picks' },
  answerAFewQuickQuestions: { ar: 'جاوب على أسئلة سريعة ونرتب لك البيوت اللي تناسبك.', en: 'Answer a few quick questions and we’ll rank the homes that fit you.' },
  bookTheViewingYourself: { ar: 'واحجز معاينته بنفسك.', en: 'book the viewing yourself.' },
  browseByArea: { ar: 'تصفح حسب المنطقة', en: 'Browse by area' },
  downPaymentYearsInstallmentInstantly: { ar: 'المقدم + عدد السنين = القسط في ثانية', en: 'Down payment + years = installment, instantly' },
  edit: { ar: 'تعديل', en: 'Edit' },
  featuredByMaqar: { ar: 'مميزة من مقر', en: 'Featured by Maqar' },
  findYourHome: { ar: 'لاقي بيتك،', en: 'Find your home,' },
  getYourPicks: { ar: 'ابدأ ترشيحاتك', en: 'Get your picks' },
  lightMode: { ar: 'الوضع الفاتح', en: 'Light mode' },
  newLaunchesOnInstallments: { ar: 'مشروعات جديدة بالتقسيط', en: 'New launches on installments' },
  pickedForYou: { ar: 'مختارة ليك', en: 'Picked for you' },
  picksThatFitYou: { ar: 'ترشيحات على مقاسك', en: 'Picks that fit you' },
  priceDrops: { ar: 'السعر نزل', en: 'Price drops' },
  tellUsYourBudgetAnd: { ar: 'قولنا ميزانيتك والمناطق اللي بتحبها، ونرتب لك البيوت الأنسب.', en: 'Tell us your budget and favourite areas, and we’ll rank the homes that fit.' },
  whatYoureLookingFor: { ar: 'اللي بتدور عليه', en: 'What you’re looking for' },
  youHaventToldUsWhat: { ar: 'لسه مقولتلناش بتدور على إيه', en: 'You haven’t told us what you’re looking for' },
  buy: { ar: 'شراء', en: 'Buy' },
  rent: { ar: 'إيجار', en: 'Rent' },
  projects: { ar: 'مشروعات', en: 'Projects' },
  stays: { ar: 'إقامة', en: 'Stays' },
  upToMonthly: (amount: number): Bi => ({ ar: `لحد ${fmtMoney(amount, 'ar')} في الشهر`, en: `Up to ${fmtMoney(amount, 'en')} a month` }),
  upTo: (amount: number): Bi => ({ ar: `لحد ${fmtMoney(amount, 'ar')}`, en: `Up to ${fmtMoney(amount, 'en')}` }),
  bedsPlus: (n: number): Bi => ({ ar: `${arNum(n)}+ غرف`, en: `${n}+ bedrooms` }),
} satisfies Record<string, Message>;
