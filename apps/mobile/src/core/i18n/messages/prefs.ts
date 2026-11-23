import { count, type Bi } from '@mqr/shared';
import type { Message } from './types';
import { FORMS } from './forms';

export const prefs = {
  aFewQuickQuestionsAnd: { ar: 'أسئلة سريعة ونرشحلك العقارات اللي تناسبك فعلاً.', en: 'A few quick questions and we’ll suggest homes that actually fit you.' },
  any: { ar: 'أي عدد', en: 'Any' },
  any2: { ar: 'أي', en: 'Any' },
  budget: { ar: 'الميزانية', en: 'Budget' },
  couldntSaveYourPreferencesTry: { ar: 'معرفناش نحفظ تفضيلاتك. جرّب تاني.', en: 'Couldn’t save your preferences. Try again.' },
  eGAhmed: { ar: 'مثلاً: أحمد', en: 'e.g. Ahmed' },
  minimumBedrooms: { ar: 'أقل عدد غرف', en: 'Minimum bedrooms' },
  monthlyBudget: { ar: 'ميزانيتك الشهرية؟', en: 'Monthly budget?' },
  mustHaves: { ar: 'مميزات لازم تكون موجودة', en: 'Must-haves' },
  neverShownToAnyoneWe: { ar: 'مش هنعرضها لحد. بنستخدمها بس عشان نرتب لك الأنسب.', en: 'Never shown to anyone. We only use it to rank what fits you.' },
  perMonth: { ar: 'في الشهر', en: 'per month' },
  pickOneOrMoreAreas: { ar: 'اختار منطقة أو أكتر، أو سيبها مفتوحة.', en: 'Pick one or more areas, or leave it open.' },
  pickOneOrMoreOr: { ar: 'اختار نوع أو أكتر، أو سيبها مفتوحة.', en: 'Pick one or more, or leave it open.' },
  savePreferences: { ar: 'احفظ تفضيلاتك', en: 'Save preferences' },
  showMyPicks: { ar: 'اعرض ترشيحاتي', en: 'Show my picks' },
  totalUnitPrice: { ar: 'إجمالي سعر الوحدة', en: 'total unit price' },
  typeTheBudget: { ar: 'اكتب الميزانية', en: 'Type the budget' },
  welcomeToMqr: { ar: 'أهلاً بيك في مقر', en: 'Welcome to MQR' },
  whatAreYouLookingFor: { ar: 'بتدور على إيه؟', en: 'What are you looking for?' },
  whatKindOfHome: { ar: 'نوع الوحدة؟', en: 'What kind of home?' },
  whatMattersToYou: { ar: 'إيه اللي يهمك؟', en: 'What matters to you?' },
  whereAreYouLooking: { ar: 'بتدور فين؟', en: 'Where are you looking?' },
  yourTopBudget: { ar: 'ميزانيتك القصوى؟', en: 'Your top budget?' },
  homesMatch70: { ar: 'عقار يناسبك بنسبة ٧٠٪ أو أكتر', en: 'homes match you 70% or more' },
  bedsOrMore: (n: number): Bi => ({ ar: `${count(n, FORMS.bedroom, 'ar')} أو أكتر`, en: `${n}+ bedrooms` }),
} satisfies Record<string, Message>;
