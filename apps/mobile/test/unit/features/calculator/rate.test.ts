import { parseRate } from '@/features/calculator/rate';

describe('parseRate', () => {
  it.each([
    ['18', 18],
    ['12.5', 12.5],
    ['١٨', 18],
    ['١٢٫٥', 12.5],
    ['12,5', 12.5],
    ['18.', 18],
    ['', 0],
    ['abc', 0],
    ['1.2.3', 0],
  ])('reads %s as %s', (text, expected) => {
    expect(parseRate(text)).toBe(expected);
  });

  it('stays between 0 and 40, like the demo', () => {
    expect(parseRate('99')).toBe(40);
    expect(parseRate('-5')).toBe(5);
  });
});
