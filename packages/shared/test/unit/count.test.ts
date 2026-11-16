import { count, joinParts, pickField } from '../../src/format.js';

describe('count', () => {
  const homes = {
    ar: ['بيت', 'بيتين', 'بيوت', 'بيت'] as [string, string, string, string],
    en: ['home', 'homes'] as [string, string],
  };

  it('uses the Arabic forms: one, two, 3–10, and the singular for 0 and 11 up', () => {
    expect([0, 1, 2, 3, 10, 11, 100, 2141].map((n) => count(n, homes, 'ar'))).toEqual([
      '٠ بيت',
      'بيت',
      'بيتين',
      '٣ بيوت',
      '١٠ بيوت',
      '١١ بيت',
      '١٠٠ بيت',
      '٢٬١٤١ بيت',
    ]);
  });

  it('uses the English singular for one and the plural otherwise', () => {
    expect([0, 1, 2].map((n) => count(n, homes, 'en'))).toEqual(['0 homes', '1 home', '2 homes']);
  });
});

describe('joinParts', () => {
  it('joins with the Arabic comma in Arabic and the Latin comma in English', () => {
    expect(joinParts(['أ', 'ب'], 'ar')).toBe('أ، ب');
    expect(joinParts(['a', 'b'], 'en')).toBe('a, b');
  });

  it('skips empty and missing parts', () => {
    expect(joinParts(['a', null, '', '  ', undefined, 'b'], 'en')).toBe('a, b');
  });
});

describe('pickField', () => {
  it('picks the language field and falls back to the other one', () => {
    expect(pickField({ nameAr: 'شقة', nameEn: 'Flat' }, 'name', 'ar')).toBe('شقة');
    expect(pickField({ nameAr: 'شقة', nameEn: 'Flat' }, 'name', 'en')).toBe('Flat');
    expect(pickField({ nameAr: 'شقة', nameEn: '' }, 'name', 'en')).toBe('شقة');
    expect(pickField({ nameAr: '', nameEn: 'Flat' }, 'name', 'ar')).toBe('Flat');
  });
});
