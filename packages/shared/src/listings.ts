import type { PropertyCard, Page } from './api.js';
import type { Category, Feature, Finishing, PropertyStatus, PropertyType } from './enums.js';
import { fmtNum } from './format.js';
import { type Bi, PROPERTY_TYPE_LABEL } from './labels.js';

// ---- Admin listings (phase 17) ----
// There are no owner accounts: an owner talks to Maqar and an admin creates and manages the
// listing. It goes live when the admin publishes it; there is no review step.

/** The most photos one listing keeps. */
export const LISTING_IMAGES_MAX = 20;

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, Bi> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  approved: { ar: 'منشور', en: 'Live' },
  unpublished: { ar: 'موقوف', en: 'Unpublished' },
  sold: { ar: 'اتباع', en: 'Sold' },
  rented: { ar: 'اتأجر', en: 'Rented' },
};

function bedsAr(beds: number): string {
  if (beds === 1) return 'غرفة واحدة';
  if (beds === 2) return 'غرفتين';
  return `${fmtNum(beds, 'ar')} ${beds <= 10 ? 'غرف' : 'غرفة'}`;
}

/** The title a listing gets when the admin leaves it empty (contract §9.2): "<type> <beds> beds | <area>". */
export function defaultTitle(p: { type: PropertyType; beds: number }, area: { nameAr: string; nameEn: string }): Bi {
  const type = PROPERTY_TYPE_LABEL[p.type];
  if (p.beds <= 0) return { ar: `${type.ar} | ${area.nameAr}`, en: `${type.en} | ${area.nameEn}` };
  return {
    ar: `${type.ar} ${bedsAr(p.beds)} | ${area.nameAr}`,
    en: `${type.en}, ${p.beds} ${p.beds === 1 ? 'bed' : 'beds'} | ${area.nameEn}`,
  };
}

/** A home for sale or a project closes as sold; one to rent or a stay as rented. */
export function closedStatusFor(category: Category): 'sold' | 'rented' {
  return category === 'sale' || category === 'project' ? 'sold' : 'rented';
}

/**
 * The status changes an admin can make. Publishing (`approved`) works from anything not live,
 * so a deal that fell through can go back up. Unpublishing is for live listings. Closing (sold or
 * rented) is for a listing that was published, never a draft, and only once.
 */
export function canMoveTo(from: PropertyStatus, to: PropertyStatus): boolean {
  switch (to) {
    case 'approved':
      return from !== 'approved';
    case 'unpublished':
      return from === 'approved';
    case 'sold':
    case 'rented':
      return from === 'approved' || from === 'unpublished';
    default:
      return false;
  }
}

/** `POST /admin/listings` and `PATCH /admin/listings/:id` (every field optional there). */
export type ListingBody = {
  category: Category;
  type: PropertyType;
  areaId: string;
  /** Left empty, each becomes the default title. */
  titleAr?: string;
  titleEn?: string;
  compoundAr?: string;
  compoundEn?: string;
  developerAr?: string | null;
  developerEn?: string | null;
  /** Whole EGP: per month for rent, per night for stays. */
  price: number;
  beds: number;
  baths: number;
  sizeM2: number;
  floor?: number | null;
  finishing: Finishing;
  delivery: 'ready' | number;
  maintenanceFee?: number | null;
  plan?: { downPct: number; years: number } | null;
  descAr?: string;
  descEn?: string;
  features: Feature[];
  /** Paths from `POST /uploads`, cover first. At least one. */
  images: string[];
  location?: { lat: number; lng: number } | null;
  /** Edit only: picked by the Maqar team, shown first on Home (phase 18). */
  featured?: boolean;
  /** Edit only: move a published listing to another active advisor (phase 18). */
  agentId?: number;
  /** Who the home belongs to. Admins only ever see it. */
  ownerName?: string | null;
  ownerPhone?: string | null;
};

/** The advisor a listing is assigned to, as the admin tools show them. */
export type AdminAgent = { id: number; nameAr: string; nameEn: string; colour: string };

/** `GET /admin/agents`: active advisors, with how many live listings each has. */
export type AdminAgentOption = AdminAgent & { live: number };

/** A row of `GET /admin/listings`: any status. */
export type AdminListingItem = Omit<PropertyCard, 'publishedAt' | 'match'> & {
  status: PropertyStatus;
  publishedAt: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerPhone: string | null;
  agent: AdminAgent | null;
  views: number;
};

/** `GET /admin/listings`: a page, plus how many listings each status has (for the filter chips). */
export type AdminListingsPage = Page<AdminListingItem> & { counts: Record<PropertyStatus, number> };

/** `GET /admin/listings/:id`: everything the form edits. */
export type AdminListing = AdminListingItem & {
  developerAr: string | null;
  developerEn: string | null;
  floor: number | null;
  maintenanceFee: number | null;
  descAr: string;
  descEn: string;
  features: Feature[];
  images: string[];
  location: { lat: number; lng: number } | null;
};

/** `POST /admin/listings/:id/publish`. Without an advisor, the one with the fewest live listings is picked. */
export type PublishBody = { agentId?: number };

/** `POST /uploads`: where the photo is now. */
export type UploadResponse = { url: string };
