import { chatPreview } from '../../src/chat.js';

describe('chatPreview', () => {
  it('is the text itself, or what the card is', () => {
    expect(chatPreview({ kind: 'text', text: 'لسه متاحة؟' }, 'ar')).toBe('لسه متاحة؟');
    expect(chatPreview({ kind: 'images', urls: ['/a.jpg'] }, 'en')).toBe('📷 Photo');
    expect(chatPreview({ kind: 'images', urls: ['/a.jpg', '/b.jpg'] }, 'en')).toBe('📷 2 photos');
    expect(chatPreview({ kind: 'plan', price: 1, downPct: 10, years: 8, monthly: 1 }, 'en')).toBe('🧮 Payment plan');
    expect(chatPreview({ kind: 'slots', date: '2026-11-12', times: ['16:00'], chosen: null }, 'en')).toBe('🗓️ Viewing times, 12 Nov');
    expect(chatPreview({ kind: 'booking', viewingId: 1, date: '2026-11-12', time: '16:00' }, 'ar')).toBe('✅ المعاينة اتأكدت: ١٢ نوفمبر ٤:٠٠ م');
  });
});
