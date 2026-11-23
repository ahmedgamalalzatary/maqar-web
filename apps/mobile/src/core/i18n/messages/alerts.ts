import type { Bi } from '@mqr/shared';

export const alerts = {
  alertOnDrop: { ar: 'نبهني لو نزل', en: 'Alert on drop' },
  following: { ar: 'متابع السعر', en: 'Following' },
  getAnAlertIfThe: { ar: 'تنبيه لو سعر الوحدة نزل', en: 'Get an alert if the price drops' },
  noPriceAlertsYet: { ar: 'مفيش تنبيهات أسعار لسه', en: 'No price alerts yet' },
  priceAlert: { ar: 'تنبيه السعر', en: 'Price alert' },
  priceAlertOff: { ar: 'تم إيقاف تنبيه السعر', en: 'Price alert off' },
  signInToFollowPrices: { ar: 'سجّل دخولك عشان تتابع الأسعار', en: 'Sign in to follow prices' },
  tapAlertOnDropOn: { ar: 'دوس "نبهني لو نزل" في صفحة أي وحدة.', en: 'Tap “Alert on drop” on any home’s page.' },
  turnOnAnAlertFor: { ar: 'فعّل التنبيه على أي وحدة، وأول ما السعر ينزل هيوصلك إشعار فوراً.', en: 'Turn on an alert for any home, and the moment its price drops you get a notification.' },
  wellTellYouIfThe: { ar: 'هنبلغك لو السعر نزل', en: 'We’ll tell you if the price drops' },
  wellTellYouTheMoment: { ar: 'هنبلغك أول ما سعر الوحدة اللي بتتابعها ينزل.', en: 'We’ll tell you the moment a home you follow gets cheaper.' },
} satisfies Record<string, Bi>;
