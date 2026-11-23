import { BATHS_OPTIONS, BEDS_OPTIONS, type Bi, type Category, type Delivery, fmtMoney, fmtNum, type Lang, localDigits, SIZE_SCALE } from '@mqr/shared';
import { m } from '@/core/i18n';

type T = (msg: Bi) => string;

const BEDS_TOP = BEDS_OPTIONS[BEDS_OPTIONS.length - 1];
const BATHS_TOP = BATHS_OPTIONS[BATHS_OPTIONS.length - 1];

/** "٥+" on the chip, "٥+ غرف" for screen readers and the active chips. */
export function bedsLabel(n: number, t: T, lang: Lang) {
  const text = `${fmtNum(n, lang)}${n === BEDS_TOP ? '+' : ''}`;
  return { text, label: t(m.listings.bedsChip(n, n === BEDS_TOP)) };
}

export function bathsLabel(n: number, t: T, lang: Lang) {
  const text = `${fmtNum(n, lang)}${n === BATHS_TOP ? '+' : ''}`;
  return { text, label: t(m.listings.bathsChip(n, n === BATHS_TOP)) };
}

export function deliveryLabel(d: Delivery, t: T, lang: Lang) {
  if (d === 'ready') return { text: t(m.listings.readyNow), label: t(m.listings.readyToMoveIn) };
  const year = localDigits(String(d), lang);
  return { text: year, label: t(m.common.deliveryYear(d)) };
}

/** The price section's title: the price means something else per category. */
export function priceTitle(category: Category | undefined, t: T) {
  if (category === 'rent') return t(m.listings.monthlyRent);
  if (category === 'stay') return t(m.listings.pricePerNight);
  return t(m.listings.priceRange);
}

/** "٥٠٠ ألف – أي سعر": a range for chips and the sheet. */
export function priceRangeText(min: number | undefined, max: number | undefined, t: T, lang: Lang) {
  return `${fmtMoney(min ?? 0, lang)} – ${max === undefined ? t(m.listings.any) : fmtMoney(max, lang)}`;
}

export function sizeRangeText(min: number, max: number | undefined, t: T, lang: Lang) {
  return `${fmtNum(min, lang)} – ${max === undefined ? `${fmtNum(SIZE_SCALE.max, lang)}+` : fmtNum(max, lang)} ${t(m.common.m)}`;
}
