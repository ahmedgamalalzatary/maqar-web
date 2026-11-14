import { calculatorProblem, contactLinks, contactProblem, DEFAULT_APP_SETTINGS, HOME_SECTIONS, homeSectionOrder, splashProblem, yearsLimits } from '../../src/settings.js';

describe('app settings the admin controls (phase 29)', () => {
  it('orders the Home sections as saved, and never loses or repeats one', () => {
    expect(homeSectionOrder([])).toEqual([...HOME_SECTIONS]);
    const order = homeSectionOrder(['launches', 'areas', 'launches', 'gone']);
    expect(order.slice(0, 2)).toEqual(['launches', 'areas']);
    expect([...order].sort()).toEqual([...HOME_SECTIONS].sort());
  });

  it('takes a calculator whose numbers make sense', () => {
    expect(calculatorProblem(DEFAULT_APP_SETTINGS.calculator)).toBeNull();
    expect(calculatorProblem({ minDownPct: 10, minYears: 2, maxYears: 8 })).toBeNull();
    // Any whole percent from 0 to 50, typed by the admin (owner, 2026-11-14).
    expect(calculatorProblem({ minDownPct: 11, minYears: 1, maxYears: 10 })).toBeNull();
    expect(calculatorProblem({ minDownPct: 0, minYears: 1, maxYears: 10 })).toBeNull();
    expect(calculatorProblem({ minDownPct: 50, minYears: 1, maxYears: 10 })).toBeNull();
    expect(calculatorProblem({ minDownPct: 12.5, minYears: 1, maxYears: 10 })).toBe('down');
    expect(calculatorProblem({ minDownPct: -1, minYears: 1, maxYears: 10 })).toBe('down');
    expect(calculatorProblem({ minDownPct: 55, minYears: 1, maxYears: 10 })).toBe('down');
    expect(calculatorProblem({ minDownPct: 10, minYears: 0, maxYears: 10 })).toBe('years');
    expect(calculatorProblem({ minDownPct: 10, minYears: 6, maxYears: 5 })).toBe('years');
    expect(calculatorProblem({ minDownPct: 10, minYears: 1, maxYears: 31 })).toBe('years');
  });

  it('lets a listing with its own plan go past the limits', () => {
    const c = { minDownPct: 10, minYears: 3, maxYears: 8 };
    expect(yearsLimits(c, 5)).toEqual({ min: 3, max: 8 });
    expect(yearsLimits(c, 12)).toEqual({ min: 3, max: 12 });
    expect(yearsLimits(c, 1)).toEqual({ min: 1, max: 8 });
  });

  it('wants a file for an image or video splash, and short text', () => {
    expect(splashProblem({ kind: 'none', media: null, textAr: '', textEn: '' })).toBeNull();
    expect(splashProblem({ kind: 'image', media: null, textAr: '', textEn: '' })).toBe('media');
    expect(splashProblem({ kind: 'video', media: '/uploads/videos/a.mp4', textAr: 'أهلا', textEn: 'Hi' })).toBeNull();
    expect(splashProblem({ kind: 'none', media: null, textAr: 'x'.repeat(81), textEn: '' })).toBe('text');
  });
});

describe('the contact details an admin sets for Contact us (2026-11-14)', () => {
  const empty = { email: '', phone: '', whatsapp: '', facebook: '', instagram: '', tiktok: '' };

  it('starts with the support address and nothing else', () => {
    expect(DEFAULT_APP_SETTINGS.contact).toEqual({ ...empty, email: 'maqarcompany@gmail.com' });
    expect(contactProblem(DEFAULT_APP_SETTINGS.contact)).toBeNull();
    expect(contactProblem(empty)).toBeNull();
  });

  it('takes an email, phone numbers and web links, and names the first field that is wrong', () => {
    const good = {
      email: 'info@maqar.app',
      phone: '01012345678',
      whatsapp: '+20 101 234 5678',
      facebook: 'https://facebook.com/maqar',
      instagram: 'https://www.instagram.com/maqar',
      tiktok: 'https://www.tiktok.com/@maqar',
    };
    expect(contactProblem(good)).toBeNull();
    expect(contactProblem({ ...good, email: 'not-an-email' })).toBe('email');
    expect(contactProblem({ ...good, phone: '12' })).toBe('phone');
    expect(contactProblem({ ...good, whatsapp: 'call me' })).toBe('whatsapp');
    expect(contactProblem({ ...good, facebook: 'facebook.com/maqar' })).toBe('facebook');
    expect(contactProblem({ ...good, instagram: 'javascript:alert(1)' })).toBe('instagram');
    expect(contactProblem({ ...good, tiktok: 'https://' })).toBe('tiktok');
  });

  it('turns the details into the links the app opens', () => {
    expect(contactLinks({ ...empty, email: 'info@maqar.app', phone: '010 1234 5678', whatsapp: '01012345678' })).toEqual({
      email: 'mailto:info@maqar.app',
      phone: 'tel:01012345678',
      // WhatsApp wants the country code: an Egyptian 0… number becomes 20….
      whatsapp: 'https://wa.me/201012345678',
      facebook: null,
      instagram: null,
      tiktok: null,
    });
    expect(contactLinks({ ...empty, whatsapp: '+971 50 123 4567', instagram: 'https://instagram.com/maqar' })).toMatchObject({
      email: null,
      whatsapp: 'https://wa.me/971501234567',
      instagram: 'https://instagram.com/maqar',
    });
  });
});
