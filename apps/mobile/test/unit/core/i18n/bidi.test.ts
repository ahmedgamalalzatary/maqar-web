import { rtlLine } from '@/core/i18n';

describe('rtlLine', () => {
  it('in Arabic, starts a line that opens with Latin letters right to left', () => {
    expect(rtlLine('Phone Test | شقة مفروشة | الأربعاء ١١ نوفمبر', 'ar')).toBe('‏Phone Test | شقة مفروشة | الأربعاء ١١ نوفمبر');
    expect(rtlLine('  OK تمام', 'ar')).toBe('‏  OK تمام');
  });

  it('leaves Arabic-first lines, English, and the English app alone', () => {
    expect(rtlLine('لسه متاحة؟', 'ar')).toBe('لسه متاحة؟');
    expect(rtlLine('١١:٠٠ ص', 'ar')).toBe('١١:٠٠ ص');
    expect(rtlLine('Phone Test | Flat', 'en')).toBe('Phone Test | Flat');
  });
});
