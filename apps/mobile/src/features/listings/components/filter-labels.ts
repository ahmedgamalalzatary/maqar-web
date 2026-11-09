import { BATHS_OPTIONS, BEDS_OPTIONS, type Category, type Delivery, fmtMoney, fmtNum, type Lang, localDigits, SIZE_SCALE } from '@maqar/shared';

type T = (ar: string, en: string) => string;

const BEDS_TOP = BEDS_OPTIONS[BEDS_OPTIONS.length - 1];
const BATHS_TOP = BATHS_OPTIONS[BATHS_OPTIONS.length - 1];

/** "٥+" on the chip, "٥+ غرف" for screen readers and the active chips. */
export function bedsLabel(n: number, t: T, lang: Lang) {
  const text = `${fmtNum(n, lang)}${n === BEDS_TOP ? '+' : ''}`;
  return { text, label: t(`${text} غرف`, `${text} ${n === 1 ? 'bedroom' : 'bedrooms'}`) };
}

export function bathsLabel(n: number, t: T, lang: Lang) {
  const text = `${fmtNum(n, lang)}${n === BATHS_TOP ? '+' : ''}`;
  return { text, label: t(`${text} حمام`, `${text} ${n === 1 ? 'bathroom' : 'bathrooms'}`) };
}

export function deliveryLabel(d: Delivery, t: T, lang: Lang) {
  if (d === 'ready') return { text: t('فوري', 'Ready now'), label: t('استلام فوري', 'Ready to move in') };
  const year = localDigits(String(d), lang);
  return { text: year, label: t(`استلام ${year}`, `Delivery ${year}`) };
}

/** The price section's title: the price means something else per category. */
export function priceTitle(category: Category | undefined, t: T) {
  if (category === 'rent') return t('الإيجار الشهري', 'Monthly rent');
  if (category === 'stay') return t('سعر الليلة', 'Price per night');
  return t('نطاق السعر', 'Price range');
}

/** "٥٠٠ ألف – أي سعر": a range for chips and the sheet. */
export function priceRangeText(min: number | undefined, max: number | undefined, t: T, lang: Lang) {
  return `${fmtMoney(min ?? 0, lang)} – ${max === undefined ? t('أي سعر', 'any') : fmtMoney(max, lang)}`;
}

export function sizeRangeText(min: number, max: number | undefined, t: T, lang: Lang) {
  return `${fmtNum(min, lang)} – ${max === undefined ? `${fmtNum(SIZE_SCALE.max, lang)}+` : fmtNum(max, lang)} ${t('م²', 'm²')}`;
}
