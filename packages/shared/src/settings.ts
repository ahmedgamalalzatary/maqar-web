import type { Bi } from './labels.js';
import { SUPPORT_EMAIL } from './site.js';

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

/**
 * What the limits themselves may be. The least down payment is any whole percent the admin types
 * (owner, 2026-11-14); the client's slider starts there and then moves in steps of 5 up to 60%.
 */
export const CALCULATOR_BOUNDS = { downMax: 50, yearsMax: 30 } as const;

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

/**
 * What the client's Contact us screen shows (owner, 2026-11-14). An empty field is not shown.
 * Phone numbers as the admin types them; the social pages as full web links.
 */
export type ContactSettings = {
  email: string;
  phone: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
};

export const CONTACT_FIELDS = ['email', 'phone', 'whatsapp', 'facebook', 'instagram', 'tiktok'] as const satisfies readonly (keyof ContactSettings)[];
export type ContactField = (typeof CONTACT_FIELDS)[number];
export const CONTACT_MAX = 200;

export type AppSettings = {
  splash: SplashSettings;
  calculator: CalculatorSettings;
  home: { sections: HomeSection[] };
  contact: ContactSettings;
};

/** `PUT /admin/settings`: any of the parts. A video's poster comes from the server. */
export type AppSettingsBody = {
  splash?: Omit<SplashSettings, 'poster'>;
  calculator?: CalculatorSettings;
  home?: { sections: HomeSection[] };
  contact?: ContactSettings;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  splash: { kind: 'none', media: null, poster: null, textAr: '', textEn: '' },
  calculator: { minDownPct: 0, minYears: 1, maxYears: 10 },
  home: { sections: [...HOME_SECTIONS] },
  contact: { email: SUPPORT_EMAIL, phone: '', whatsapp: '', facebook: '', instagram: '', tiktok: '' },
};

/** The saved order first (unknown names and repeats dropped), then any section it leaves out. */
export function homeSectionOrder(saved: readonly string[]): HomeSection[] {
  const known = saved.filter((s, i): s is HomeSection => (HOME_SECTIONS as readonly string[]).includes(s) && saved.indexOf(s) === i);
  return [...known, ...HOME_SECTIONS.filter((s) => !known.includes(s))];
}

/** What is wrong with the calculator's limits, or null. */
export function calculatorProblem(c: CalculatorSettings): 'down' | 'years' | null {
  const { downMax, yearsMax } = CALCULATOR_BOUNDS;
  if (!Number.isInteger(c.minDownPct) || c.minDownPct < 0 || c.minDownPct > downMax) return 'down';
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The digits of a phone number typed with spaces, dashes or brackets, keeping a leading +. */
const phoneDigits = (s: string) => s.replace(/[\s\-()]/g, '');
const PHONE = /^\+?\d{7,15}$/;
/** A full web address: http(s), a host with a dot, then any path. */
const WEB_LINK = /^https?:\/\/[^\s/?#@]+\.[^\s/?#@]+([/?#]\S*)?$/i;
const isWebLink = (s: string) => WEB_LINK.test(s);

/** The first contact field that is filled in wrong, or null. Empty fields are fine. */
export function contactProblem(c: ContactSettings): ContactField | null {
  for (const f of CONTACT_FIELDS) {
    const v = c[f].trim();
    if (!v) continue;
    if (v.length > CONTACT_MAX) return f;
    if (f === 'email' ? !EMAIL.test(v) : f === 'phone' || f === 'whatsapp' ? !PHONE.test(phoneDigits(v)) : !isWebLink(v)) return f;
  }
  return null;
}

/** What each filled field opens: mail, a call, a WhatsApp chat or the page; null when it is empty. */
export function contactLinks(c: ContactSettings): Record<ContactField, string | null> {
  const wa = phoneDigits(c.whatsapp.trim()).replace(/^\+/, '');
  return {
    email: c.email.trim() ? `mailto:${c.email.trim()}` : null,
    phone: c.phone.trim() ? `tel:${phoneDigits(c.phone.trim())}` : null,
    // WhatsApp wants the country code; an Egyptian number written from 0 gets 20.
    whatsapp: wa ? `https://wa.me/${wa.startsWith('0') ? `20${wa.slice(1)}` : wa}` : null,
    facebook: c.facebook.trim() || null,
    instagram: c.instagram.trim() || null,
    tiktok: c.tiktok.trim() || null,
  };
}
