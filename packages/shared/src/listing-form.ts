import type { Category, Feature, Finishing, PropertyType } from './enums.js';
import type { AdminListing, ListingBody } from './listings.js';

// The listing form's rules (phase 17), shared by the app's admin screens and the web dashboard.

/** The five steps of the listing form (contract §9.2). */
export const LISTING_STEPS = ['type', 'location', 'details', 'photos', 'review'] as const;
export type ListingStep = (typeof LISTING_STEPS)[number];

/** A photo on the form: picked on the phone (`local`) until it is uploaded (`url`). */
export type ListingFormPhoto = { key: string; url?: string; local?: string; failed?: boolean };

/** What the form holds. Numbers stay text while typed, as the fields show them. */
export type ListingForm = {
  category: Category;
  type: PropertyType | null;
  areaId: string | null;
  titleAr: string;
  titleEn: string;
  compoundAr: string;
  compoundEn: string;
  beds: string;
  baths: string;
  sizeM2: string;
  price: string;
  finishing: Finishing | null;
  delivery: 'ready' | number;
  features: Feature[];
  downPct: string;
  planYears: string;
  descAr: string;
  descEn: string;
  ownerName: string;
  ownerPhone: string;
  photos: ListingFormPhoto[];
};

export type ListingField = keyof ListingForm;

export const emptyListingForm = (): ListingForm => ({
  category: 'sale',
  type: null,
  areaId: null,
  titleAr: '',
  titleEn: '',
  compoundAr: '',
  compoundEn: '',
  beds: '',
  baths: '',
  sizeM2: '',
  price: '',
  finishing: null,
  delivery: 'ready',
  features: [],
  downPct: '',
  planYears: '',
  descAr: '',
  descEn: '',
  ownerName: '',
  ownerPhone: '',
  photos: [],
});

/** A whole number typed in Arabic or Latin digits, with or without separators. */
export function readWholeNumber(text: string): number | undefined {
  const latin = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\s,٬،]/g, '');
  return /^\d+$/.test(latin) ? Number(latin) : undefined;
}

const between = (text: string, min: number, max: number) => {
  const n = readWholeNumber(text);
  return n !== undefined && n >= min && n <= max;
};

/** Only homes for sale and projects are paid in installments. */
export const hasPaymentPlan = (c: Category) => c === 'sale' || c === 'project';

/** The fields on this step that stop the form going on. */
export function listingStepErrors(step: ListingStep, s: ListingForm): ListingField[] {
  const bad: ListingField[] = [];
  if (step === 'type' && !s.type) bad.push('type');
  if (step === 'location' && !s.areaId) bad.push('areaId');
  if (step === 'details') {
    if (!between(s.beds, 0, 20)) bad.push('beds');
    if (!between(s.baths, 0, 20)) bad.push('baths');
    if (!between(s.sizeM2, 10, 65_000)) bad.push('sizeM2');
    if (!between(s.price, 1, 10_000_000_000)) bad.push('price');
    if (!s.finishing) bad.push('finishing');
    if (hasPaymentPlan(s.category) && (s.downPct || s.planYears)) {
      if (!between(s.downPct, 0, 100)) bad.push('downPct');
      if (!between(s.planYears, 1, 30)) bad.push('planYears');
    }
  }
  if (step === 'photos' && (!s.photos.length || s.photos.some((p) => !p.url))) bad.push('photos');
  return bad;
}

/** Every step's problems, for the review step. */
export const listingFormErrors = (s: ListingForm): ListingField[] => LISTING_STEPS.flatMap((step) => listingStepErrors(step, s));

const orNull = (text: string) => text.trim() || null;

/** The request body. Empty titles are sent empty, so the server makes the default title. */
export function listingBodyOf(s: ListingForm): ListingBody {
  const plan = hasPaymentPlan(s.category) && s.downPct && s.planYears ? { downPct: readWholeNumber(s.downPct)!, years: readWholeNumber(s.planYears)! } : null;
  return {
    category: s.category,
    type: s.type!,
    areaId: s.areaId!,
    titleAr: s.titleAr.trim(),
    titleEn: s.titleEn.trim(),
    compoundAr: s.compoundAr.trim(),
    compoundEn: s.compoundEn.trim(),
    descAr: s.descAr.trim(),
    descEn: s.descEn.trim(),
    price: readWholeNumber(s.price)!,
    beds: readWholeNumber(s.beds)!,
    baths: readWholeNumber(s.baths)!,
    sizeM2: readWholeNumber(s.sizeM2)!,
    finishing: s.finishing!,
    delivery: s.delivery,
    features: s.features,
    plan,
    images: s.photos.flatMap((p) => (p.url ? [p.url] : [])),
    ownerName: orNull(s.ownerName),
    ownerPhone: orNull(s.ownerPhone),
  };
}

/** The form for editing a saved listing. */
export function listingFormOf(l: AdminListing): ListingForm {
  return {
    category: l.category,
    type: l.type,
    areaId: l.area.id,
    titleAr: l.titleAr,
    titleEn: l.titleEn,
    compoundAr: l.compoundAr,
    compoundEn: l.compoundEn,
    beds: String(l.beds),
    baths: String(l.baths),
    sizeM2: String(l.sizeM2),
    price: String(l.price),
    finishing: l.finishing,
    delivery: l.delivery,
    features: l.features,
    downPct: l.plan ? String(l.plan.downPct) : '',
    planYears: l.plan ? String(l.plan.years) : '',
    descAr: l.descAr,
    descEn: l.descEn,
    ownerName: l.ownerName ?? '',
    ownerPhone: l.ownerPhone ?? '',
    photos: l.images.map((url) => ({ key: url, url })),
  };
}
