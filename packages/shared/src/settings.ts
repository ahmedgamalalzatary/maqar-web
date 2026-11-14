import type { Bi } from './labels.js';

// ---- App settings an admin controls (phase 29, contract §11) ----
// The opening screen, the calculator's limits and the order of the Home sections. Everyone reads
// them (`GET /settings`); only an admin changes them (`PUT /admin/settings`).

export const SPLASH_KINDS = ['none', 'image', 'video'] as const;
export type SplashKind = (typeof SPLASH_KINDS)[number];

/** The longest video the opening screen plays. */
export const SPLASH_VIDEO_MAX_SECONDS = 3;
/** How long an image or text-only opening screen stays up. */
export const SPLASH_IMAGE_SECONDS = 2;
export const SPLASH_TEXT_MAX = 80;

/** The opening screen: nothing extra (the logo only), a picture, or a short video; with a line of text. */
export type SplashSettings = {
  kind: SplashKind;
  /** The uploaded picture or video; null when `kind` is none. */
  media: string | null;
  /** A video's first frame, shown while it loads. */
  poster: string | null;
  textAr: string;
  textEn: string;
};

export type CalculatorSettings = {
  /** The least down payment a client can pick, in percent (a step of 5). */
  minDownPct: number;
  minYears: number;
  maxYears: number;
};

/** What the limits themselves may be: the down-payment slider moves in steps of 5 and ends at 60%. */
export const CALCULATOR_BOUNDS = { downStep: 5, downMax: 50, yearsMax: 30 } as const;

/** The parts of Home an admin can reorder. The header, headline and search box stay on top. */
export const HOME_SECTIONS = ['shortcuts', 'nextViewing', 'featured', 'prefs', 'picks', 'areas', 'calculator', 'drops', 'launches'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export const HOME_SECTION_LABEL: Record<HomeSection, Bi> = {
  shortcuts: { ar: 'اختصارات: شراء، إيجار، مشروعات، إقامة', en: 'Shortcuts: buy, rent, projects, stays' },
  nextViewing: { ar: 'المعاينة الجاية', en: 'The next viewing' },
  featured: { ar: 'مميزة من مقر', en: 'Featured by Maqar' },
  prefs: { ar: 'بتدور على إيه (تفضيلات العميل)', en: 'What you’re looking for (the client’s preferences)' },
  picks: { ar: 'مختارة ليك', en: 'Picked for you' },
  areas: { ar: 'تصفح حسب المنطقة', en: 'Browse by area' },
  calculator: { ar: 'احسب قسطك', en: 'The calculator' },
  drops: { ar: 'أسعار نزلت', en: 'Price drops' },
  launches: { ar: 'مشروعات جديدة بالتقسيط', en: 'New launches on installments' },
};

export type AppSettings = {
  splash: SplashSettings;
  calculator: CalculatorSettings;
  home: { sections: HomeSection[] };
};

/** `PUT /admin/settings`: any of the three parts. A video's poster comes from the server. */
export type AppSettingsBody = {
  splash?: Omit<SplashSettings, 'poster'>;
  calculator?: CalculatorSettings;
  home?: { sections: HomeSection[] };
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  splash: { kind: 'none', media: null, poster: null, textAr: '', textEn: '' },
  calculator: { minDownPct: 0, minYears: 1, maxYears: 10 },
  home: { sections: [...HOME_SECTIONS] },
};

/** The saved order first (unknown names and repeats dropped), then any section it leaves out. */
export function homeSectionOrder(saved: readonly string[]): HomeSection[] {
  const known = saved.filter((s, i): s is HomeSection => (HOME_SECTIONS as readonly string[]).includes(s) && saved.indexOf(s) === i);
  return [...known, ...HOME_SECTIONS.filter((s) => !known.includes(s))];
}

/** What is wrong with the calculator's limits, or null. */
export function calculatorProblem(c: CalculatorSettings): 'down' | 'years' | null {
  const { downStep, downMax, yearsMax } = CALCULATOR_BOUNDS;
  if (!Number.isInteger(c.minDownPct) || c.minDownPct < 0 || c.minDownPct > downMax || c.minDownPct % downStep !== 0) return 'down';
  if (!Number.isInteger(c.minYears) || !Number.isInteger(c.maxYears) || c.minYears < 1 || c.maxYears > yearsMax || c.minYears > c.maxYears) return 'years';
  return null;
}

/** The years a client can type. A listing's own plan is always allowed, even outside the limits. */
export function yearsLimits(c: CalculatorSettings, planYears?: number): { min: number; max: number } {
  if (planYears === undefined) return { min: c.minYears, max: c.maxYears };
  return { min: Math.min(c.minYears, planYears), max: Math.max(c.maxYears, planYears) };
}

/** The least down payment the slider allows; a listing's own lower down payment is allowed. */
export const minDownOf = (c: CalculatorSettings, planDown?: number): number => (planDown === undefined ? c.minDownPct : Math.min(c.minDownPct, planDown));

/** What is wrong with the opening screen, or null. */
export function splashProblem(s: Omit<SplashSettings, 'poster'>): 'media' | 'text' | null {
  if (s.kind !== 'none' && !s.media) return 'media';
  if (s.textAr.trim().length > SPLASH_TEXT_MAX || s.textEn.trim().length > SPLASH_TEXT_MAX) return 'text';
  return null;
}
