import type { Bi } from '@mqr/shared';
import type { Message } from './types';
import { arNum } from './forms';

export const saved = {
  nothingSavedYet: { ar: 'لسه محفظتش حاجة', en: 'Nothing saved yet' },
  priceAlerts: { ar: 'تنبيهات السعر', en: 'Price alerts' },
  removeFromSaved: { ar: 'شيل من المحفوظة', en: 'Remove from saved' },
  saved: { ar: 'المحفوظة', en: 'Saved' },
  saved2: { ar: 'المفضلة', en: 'Saved' },
  saveHome: { ar: 'احفظ الوحدة', en: 'Save home' },
  signInToSaveHomes: { ar: 'سجّل دخولك عشان تحفظ', en: 'Sign in to save homes' },
  tapTheHeartOnAny: { ar: 'دوس على القلب في أي وحدة عشان ترجعلها بسهولة.', en: 'Tap the heart on any home to come back to it easily.' },
  yourSavedHomesStayWith: { ar: 'وحداتك المحفوظة بتفضل معاك على أي موبايل.', en: 'Your saved homes stay with you on any phone.' },
  savedCount: (n: number): Bi => ({ ar: `المفضلة (${arNum(n)})`, en: `Saved (${n})` }),
} satisfies Record<string, Message>;
