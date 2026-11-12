import type { Category, Feature, Finishing, PropertyType } from './enums.js';
import type { AdminListing, ListingBody } from './listings.js';

// The listing form's rules (phase 17), shared by the app's admin screens and the web dashboard.

/** The steps of the listing form (contract §9.2); videos (phase 26) and the 360° tour (phase 21) may stay empty. */
export const LISTING_STEPS = ['type', 'location', 'details', 'photos', 'videos', 'tour', 'review'] as const;
export type ListingStep = (typeof LISTING_STEPS)[number];

/** A photo on the form: picked on the phone (`local`) until it is uploaded (`url`). */
export type ListingFormPhoto = { key: string; url?: string; local?: string; failed?: boolean };

/** A video on the form: picked (`local`) until the server has converted it (`url`, `poster`, `durationS`). */
export type ListingFormVideo = ListingFormPhoto & { poster?: string; durationS?: number };

/** A room of the 360° tour on the form: its names and its panorama, uploaded like a photo. */
export type ListingFormRoom = ListingFormPhoto & { nameAr: string; nameEn: string };

/** What the form holds. Numbers stay text while typed, as the fields show them. */
export type ListingForm = {
  category: Category;
  type: PropertyType | null;
  areaId: string | null;
  titleAr: string;
  titleEn: string;
  compoundAr: string;
  compoundEn: string;
  developerAr: string;
  developerEn: string;
  floor: string;
  maintenanceFee: string;
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
  videos: ListingFormVideo[];
  tour: ListingFormRoom[];
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
  developerAr: '',
  developerEn: '',
  floor: '',
  maintenanceFee: '',
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
  videos: [],
  tour: [],
});

/** A whole number typed in Arabic or Latin digits, with or without separators. */
export function readWholeNumber(text: string): number | undefined {
  const latin = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\s,٬،]/g, '');
  return /^\d+$/.test(latin) ? Number(latin) : undefined;
}

/**
 * A phone as the server takes it: Latin digits with an optional leading +, 6 to 20 digits.
 * Arabic digits are read, and spaces, dashes, dots and brackets dropped. Undefined otherwise.
 */
export function readPhone(text: string): string | undefined {
  const latin = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\s\-.()]/g, '');
  return /^\+?\d{6,20}$/.test(latin) ? latin : undefined;
}

/**
 * A client's mobile number the way the API takes it on an account (8 to 15 digits, maybe a
 * leading +), from what they typed; undefined when it is not one.
 */
export function readMobile(text: string): string | undefined {
  const phone = readPhone(text);
  return phone && /^\+?\d{8,15}$/.test(phone) ? phone : undefined;
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
  if (step === 'location') {
    if (!s.areaId) bad.push('areaId');
    if (s.ownerPhone.trim() && !readPhone(s.ownerPhone)) bad.push('ownerPhone');
  }
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
  if (step === 'videos' && s.videos.some((v) => !v.url)) bad.push('videos');
  if (step === 'tour' && s.tour.some((r) => !r.url || !r.nameAr.trim() || !r.nameEn.trim())) bad.push('tour');
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
    developerAr: s.developerAr.trim() || null,
    developerEn: s.developerEn.trim() || null,
    floor: s.floor.trim() ? (readWholeNumber(s.floor) ?? null) : null,
    maintenanceFee: s.maintenanceFee.trim() ? (readWholeNumber(s.maintenanceFee) ?? null) : null,
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
    ownerPhone: s.ownerPhone.trim() ? (readPhone(s.ownerPhone) ?? s.ownerPhone.trim()) : null,
    // Always sent, so removing every video or room on an edit removes them.
    videos: s.videos.flatMap((v) => (v.url ? [v.url] : [])),
    tour: s.tour.flatMap((r) => (r.url ? [{ nameAr: r.nameAr.trim(), nameEn: r.nameEn.trim(), pano: r.url }] : [])),
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
    developerAr: l.developerAr ?? '',
    developerEn: l.developerEn ?? '',
    floor: l.floor == null ? '' : String(l.floor),
    maintenanceFee: l.maintenanceFee == null ? '' : String(l.maintenanceFee),
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
    videos: (l.videos ?? []).map((v) => ({ key: v.url, url: v.url, poster: v.poster, durationS: v.durationS })),
    tour: (l.tourRooms ?? []).map((r) => ({ key: `${r.id}`, url: r.pano, nameAr: r.nameAr, nameEn: r.nameEn })),
  };
}
