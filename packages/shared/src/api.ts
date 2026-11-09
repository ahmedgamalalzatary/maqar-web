import type {
  Category,
  Feature,
  Finishing,
  Lang,
  NotificationKind,
  PropertyType,
  PushPlatform,
  Role,
  SignUpRole,
  ThemePref,
} from './enums.js';
import type { Match, Prefs } from './match.js';
import type { ListingFilters, Sort } from './search.js';

// Request and response shapes shared by the API and the app.

/** `GET /v1/health` */
export type HealthResponse = {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  version: string;
  time: string;
};

/** The standard NestJS error body every endpoint returns on failure. */
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

// ---- Accounts (phase 1) ----

/** Passwords need at least this many characters, with a letter and a digit. */
export const PASSWORD_MIN = 8;

export type AgentProfile = {
  nameAr: string;
  nameEn: string;
  roleTitleAr: string;
  roleTitleEn: string;
  rating: number;
  dealsCount: number;
  years: number;
  phone: string;
  colour: string;
};

/** `GET /v1/me` and the `user` in every auth response. */
export type Me = {
  id: number;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  lang: Lang;
  theme: ThemePref;
  pushEnabled: boolean;
  createdAt: string;
  /** Present for sales agents only. */
  agent?: AgentProfile;
  /** Clients only: their saved preferences, or null before onboarding. */
  prefs?: Prefs | null;
};

export type AuthResponse = {
  user: Me;
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
};

/** `role` may be left out: every sign-up is a client. */
export type SignUpBody = { name: string; email: string; password: string; role?: SignUpRole; lang?: Lang };
export type SignInBody = { email: string; password: string };
export type RefreshBody = { refreshToken: string };
export type UpdateMeBody = Partial<Pick<Me, 'name' | 'phone' | 'lang' | 'theme' | 'pushEnabled'>>;
/** Deleting an account needs the current password. */
export type DeleteMeBody = { password: string };

// ---- Browse listings (phase 3) ----

/** One page of a list. `page` starts at 1. */
export type Page<T> = { items: T[]; page: number; limit: number; total: number };

/** The most items one page can hold. */
export const PAGE_LIMIT_MAX = 50;

/** `GET /v1/areas` */
export type AreaItem = {
  id: string;
  nameAr: string;
  nameEn: string;
  cityAr: string;
  cityEn: string;
  /** Path under the API host, for example `/uploads/seed/p2.jpg`. */
  image: string;
};

/** A listing as the cards and lists show it (`GET /v1/properties`). */
export type PropertyCard = {
  id: number;
  category: Category;
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  area: { id: string; nameAr: string; nameEn: string };
  compoundAr: string;
  compoundEn: string;
  /** Whole EGP: per month for rent, per night for stays. */
  price: number;
  /** The price before the last drop, when it fell. */
  oldPrice: number | null;
  beds: number;
  baths: number;
  sizeM2: number;
  finishing: Finishing;
  delivery: 'ready' | number;
  /** The installment plan, when the listing has one. */
  plan: { downPct: number; years: number } | null;
  /** The first photo, as a path under the API host. */
  cover: string | null;
  /** Has a 360° tour (phase 10). */
  tour: boolean;
  publishedAt: string;
  /** How well it fits the signed-in client: with sort=match and in recommendations (phase 6). */
  match?: Match;
};

/** `GET /v1/properties` (phase 5 adds the filters and the sort; see search.ts). */
export type PropertiesQuery = ListingFilters & { sort?: Sort; page?: number; limit?: number };

// ---- Property page (phase 4) ----

/** The sales advisor shown on a listing (contract §8.5). */
export type ListingAgent = {
  id: number;
  nameAr: string;
  nameEn: string;
  roleTitleAr: string;
  roleTitleEn: string;
  rating: number;
  dealsCount: number;
  years: number;
  languagesAr: string;
  languagesEn: string;
  avgReplyMins: number;
  phone: string;
  colour: string;
};

/** One room of a 360° tour (contract §8.6). `pano` is an equirectangular photo under the API host. */
export type TourRoom = { id: number; nameAr: string; nameEn: string; pano: string };

/** `GET /v1/properties/:id`: everything the property page shows. */
export type PropertyDetail = PropertyCard & {
  developerAr: string | null;
  developerEn: string | null;
  floor: number | null;
  /** Maintenance deposit, % of the price. */
  maintenanceFee: number | null;
  descAr: string;
  descEn: string;
  features: Feature[];
  /** Photo paths under the API host, cover first. */
  images: string[];
  /** Views, including this one. */
  views: number;
  /** The 360° tour's rooms in order; empty when the home has no tour. */
  tourRooms: TourRoom[];
  location: { lat: number; lng: number } | null;
  agent: ListingAgent;
};

// ---- Preferences and smart picks (phase 6) ----

/** `PUT /v1/me/prefs` body and response. */
export type PrefsBody = Prefs;

/** `GET /v1/properties/match-count`: homes that fit these preferences 70% or more. */
export type MatchCount = { count: number };

// ---- Notifications (phase 11) ----

/** One inbox entry (contract §8.13). `href` is the app screen a tap opens, e.g. `/property/4`. */
export type NotificationItem = {
  id: number;
  kind: NotificationKind;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

/** `GET /v1/notifications`: the newest first, and how many are unread in all. */
export type NotificationsResponse = { items: NotificationItem[]; unread: number };

/** `POST` and `DELETE /v1/me/push-tokens`: this phone's Expo push token. */
export type PushTokenBody = { token: string; platform: PushPlatform };

/** What a phone push carries besides its text: the inbox entry and the screen to open. */
export type PushData = { id: number; href: string | null };

/** The most inbox entries one request returns. */
export const NOTIFICATIONS_LIMIT = 50;
