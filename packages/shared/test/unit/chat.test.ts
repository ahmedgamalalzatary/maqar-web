import { chatPreview } from '../../src/chat.js';
import { VIEWING_STATUS_LABEL } from '../../src/reports.js';
import { canChangeViewing, isActiveViewing, isUpcoming } from '../../src/viewings.js';

describe('chatPreview', () => {
  it('is the text itself, or what the card is', () => {
    expect(chatPreview({ kind: 'text', text: 'لسه متاحة؟' }, 'ar')).toBe('لسه متاحة؟');
    expect(chatPreview({ kind: 'images', urls: ['/a.jpg'] }, 'en')).toBe('📷 Photo');
    expect(chatPreview({ kind: 'images', urls: ['/a.jpg', '/b.jpg'] }, 'en')).toBe('📷 2 photos');
    expect(chatPreview({ kind: 'plan', price: 1, downPct: 10, years: 8, monthly: 1 }, 'en')).toBe('🧮 Payment plan');
    expect(chatPreview({ kind: 'slots', date: '2026-11-12', times: ['16:00'], chosen: null }, 'en')).toBe('🗓️ Viewing times, 12 Nov');
    expect(chatPreview({ kind: 'booking', viewingId: 1, date: '2026-11-12', time: '16:00' }, 'ar')).toBe('✅ المعاينة اتأكدت: ١٢ نوفمبر ٤:٠٠ م');
  });

  // Owner, 2026-11-14: a time picked in the chat waits for the advisor.
  it('says where a booking from the chat stands', () => {
    const b = { kind: 'booking', viewingId: 1, date: '2026-11-12', time: '16:00' } as const;
    expect(chatPreview({ ...b, state: 'pending' }, 'ar')).toBe('🗓️ العميل حجز معاينة: ١٢ نوفمبر ٤:٠٠ م، مستنية التأكيد');
    expect(chatPreview({ ...b, state: 'pending' }, 'en')).toBe('🗓️ Viewing booked: 12 Nov 4:00 PM, awaiting confirmation');
    expect(chatPreview({ ...b, state: 'accepted' }, 'en')).toBe('✅ Viewing confirmed: 12 Nov 4:00 PM');
    expect(chatPreview({ ...b, state: 'moved' }, 'en')).toBe('🔁 Viewing moved to 12 Nov 4:00 PM');
    expect(chatPreview({ ...b, state: 'declined' }, 'en')).toBe('❌ The advisor declined the viewing');
    expect(chatPreview({ ...b, state: 'cancelled' }, 'en')).toBe('❌ Viewing cancelled');
  });
});

describe('a viewing waiting for the advisor', () => {
  it('holds the hour and can still be changed, like a confirmed one', () => {
    const later = new Date(Date.now() + 86_400_000).toISOString();
    expect(isActiveViewing({ status: 'pending' })).toBe(true);
    expect(isUpcoming({ status: 'pending', startsAt: later })).toBe(true);
    expect(canChangeViewing({ status: 'pending', startsAt: later })).toBe(true);
    expect(VIEWING_STATUS_LABEL.pending).toEqual({ ar: 'مستنية التأكيد', en: 'Awaiting confirmation' });
  });
});
