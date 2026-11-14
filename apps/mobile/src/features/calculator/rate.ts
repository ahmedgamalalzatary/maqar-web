const MAX_RATE = 40;

/** The annual interest typed by the user: Arabic or Latin digits, capped at 40%. Anything unreadable is 0. */
export function parseRate(text: string): number {
  const latin = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '');
  return Math.min(MAX_RATE, Number(latin) || 0);
}

/** Whole years typed in Arabic or Latin digits, from `min` to `max` (an admin sets them, phase 29); undefined otherwise. */
export function parseYears(text: string, max: number, min = 1): number | undefined {
  const latin = text.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!/^\d{1,2}$/.test(latin)) return undefined;
  const n = Number(latin);
  return n >= min && n <= max ? n : undefined;
}
