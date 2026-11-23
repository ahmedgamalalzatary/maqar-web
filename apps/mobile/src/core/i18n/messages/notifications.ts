import type { Bi } from '@mqr/shared';
import type { Message } from './types';
import { arNum } from './forms';

export const notifications = {
  allowThemForMqrIn: { ar: 'اسمح بيها لمقر من إعدادات الموبايل وجرّب تاني.', en: 'Allow them for MQR in your phone’s settings, then try again.' },
  blockedInYourPhonesSettings: { ar: 'مقفولة من إعدادات الموبايل', en: 'Blocked in your phone’s settings' },
  checkYourConnection: { ar: 'اتأكد إنك متصل بالإنترنت.', en: 'Check your connection.' },
  checkYourConnectionAndTry: { ar: 'اتأكد إنك متصل بالإنترنت وجرّب تاني.', en: 'Check your connection and try again.' },
  couldntLoadNotifications: { ar: 'معرفناش نجيب التنبيهات', en: 'Couldn’t load notifications' },
  couldntTurnNotificationsOn: { ar: 'معرفناش نشغّل الإشعارات', en: 'Couldn’t turn notifications on' },
  couldntTurnThemOff: { ar: 'معرفناش نقفلها', en: 'Couldn’t turn them off' },
  markAllRead: { ar: 'علّم الكل مقروء', en: 'Mark all read' },
  new: { ar: 'جديد: ', en: 'New: ' },
  noNotifications: { ar: 'مفيش تنبيهات', en: 'No notifications' },
  notAvailableOnThisDevice: { ar: 'مش متاحة على الجهاز ده', en: 'Not available on this device' },
  notificationsAreBlocked: { ar: 'الموبايل مانع الإشعارات', en: 'Notifications are blocked' },
  notificationsAreOn: { ar: 'الإشعارات شغالة', en: 'Notifications are on' },
  off: { ar: 'مقفولة', en: 'Off' },
  on: { ar: 'مفعّلة', en: 'On' },
  openSettings: { ar: 'افتح الإعدادات', en: 'Open settings' },
  phoneNotifications: { ar: 'إشعارات الموبايل', en: 'Phone notifications' },
  phoneNotificationsOff: { ar: 'اتقفلت إشعارات الموبايل', en: 'Phone notifications off' },
  pleaseTryAgain: { ar: 'جرّب تاني.', en: 'Please try again.' },
  signInToGetNotifications: { ar: 'سجّل دخولك عشان توصلك التنبيهات', en: 'Sign in to get notifications' },
  viewingRemindersAndPriceDrops: { ar: 'تذكير المعاينات ونزول الأسعار بيوصلوا لحسابك.', en: 'Viewing reminders and price drops come to your account.' },
  viewingRemindersAndPriceDrops2: { ar: 'هنا هتلاقي تذكير المعاينات ونزول الأسعار.', en: 'Viewing reminders and price drops will show up here.' },
  youllGetViewingRemindersAnd: { ar: 'هيوصلك تذكير المعاينات ونزول الأسعار.', en: 'You’ll get viewing reminders and price drops.' },
  youllStillSeeAlertsInside: { ar: 'هتفضل توصلك التنبيهات جوه التطبيق.', en: 'You’ll still see alerts inside the app.' },
  bellNew: (n: number): Bi => ({ ar: `التنبيهات، ${arNum(n)} جديد`, en: `Notifications, ${n} new` }),
} satisfies Record<string, Message>;
