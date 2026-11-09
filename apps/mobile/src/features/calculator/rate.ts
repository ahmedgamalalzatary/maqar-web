const MAX_RATE = 40;

/** The annual interest typed by the user: Arabic or Latin digits, capped at 40%. Anything unreadable is 0. */
export function parseRate(text: string): number {
  const latin = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '');
  return Math.min(MAX_RATE, Number(latin) || 0);
}
