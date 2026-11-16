import type { Bi } from '@maqar/shared';
import type { Message } from './types';

export const tour = {
  dragToLookAround: { ar: 'اسحب عشان تلف في الأوضة', en: 'Drag to look around' },
  gyroscope: { ar: 'الجيروسكوب', en: 'Gyroscope' },
  previousRoom: { ar: 'الغرفة اللي فاتت', en: 'Previous room' },
  tapTheWhiteDotsTo: { ar: 'دوس على النقط البيضا عشان تنقل بين الغرف', en: 'Tap the white dots to move between rooms' },
  thisHomeHasNo360: { ar: 'الوحدة دي مالهاش جولة ٣٦٠°.', en: 'This home has no 360° tour.' },
  weCouldntLoadThisRooms: { ar: 'مقدرناش نفتح صورة الغرفة دي.', en: 'We couldn’t load this room’s picture.' },
  weCouldntOpenTheTour: { ar: 'مش قادرين نفتح الجولة دلوقتي.', en: 'We couldn’t open the tour right now.' },
  goTo: (label: string): Bi => ({ ar: `انتقل إلى ${label}`, en: `Go to ${label}` }),
} satisfies Record<string, Message>;
