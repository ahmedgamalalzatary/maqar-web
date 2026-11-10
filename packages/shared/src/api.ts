import type {
  Category,
  ChatSender,
  Feature,
  Finishing,
  Lang,
  LeadSource,
  LeadStage,
  NotificationKind,
  PropertyType,
  PushPlatform,
  ReminderOffset,
  Role,
  SignUpRole,
  ThemePref,
  ViewingMode,
  ViewingStatus,
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

// ---- Price drop alerts (phase 12) ----

/** `PATCH /v1/admin/listings/:id/price`: the new price, in whole EGP. */
export type PriceChangeBody = { price: number };

/** What the listing shows after a price change. */
export type PriceChangeResponse = { price: number; oldPrice: number | null };

// ---- Viewing booking (phase 13) ----

/** A viewing hour's state (contract §8.7). */
export type SlotState = 'free' | 'taken' | 'past' | 'closed';
/** `time` is the hour in Cairo time, "16:00". */
export type Slot = { time: string; state: SlotState };
/** `date` is a Cairo calendar day, "2026-11-12". */
export type SlotDay = { date: string; slots: Slot[] };

/**
 * `GET /v1/properties/:id/slots`: the next 14 days. `defaultDate` is today, or tomorrow after
 * 19:00, moved on to the first day with a free hour.
 */
export type SlotsResponse = { days: SlotDay[]; defaultDate: string };

/** `POST /v1/viewings`. `reminders` are the client's choices (sent from Phase 14). */
export type BookViewingBody = { propertyId: number; date: string; time: string; reminders: ReminderOffset[] };

/** `PATCH /v1/viewings/:id`: move to another free hour, or cancel. */
export type UpdateViewingBody =
  | { action: 'reschedule'; date: string; time: string; reminders?: ReminderOffset[] }
  | { action: 'cancel' };

/** A viewing, for the client who booked it or the agent who meets them. Dates and times are Cairo's. */
export type ViewingItem = {
  id: number;
  status: ViewingStatus;
  mode: ViewingMode;
  date: string;
  time: string;
  /** The same moment as an ISO instant. */
  startsAt: string;
  /** Where it was before the last reschedule. */
  rescheduledFrom: { date: string; time: string } | null;
  reminders: ReminderOffset[];
  property: PropertyCard;
  /** For directions; null when the listing has no map point. */
  location: { lat: number; lng: number } | null;
  agent: ListingAgent;
  /** For the agent only: who is coming. */
  client: { name: string; phone: string | null } | null;
  createdAt: string;
};

// Sales agent (contract §10.1, §10.2). Agents only ever see their own leads.

/** A lead in lists: the phone is masked. `isNew`: booked in the app and the agent has not opened it since. */
export type LeadCard = {
  id: number;
  /** The client's name; empty for a deleted account. */
  name: string;
  phone: string | null;
  stage: LeadStage;
  source: LeadSource;
  hot: boolean;
  fromApp: boolean;
  isNew: boolean;
  budget: number | null;
  property: { id: number; titleAr: string; titleEn: string } | null;
  lastActivityAt: string;
};

/** A live viewing on the agent's day. `newFromApp`: booked in the app since the agent last opened the lead. */
export type AgentViewing = {
  id: number;
  leadId: number | null;
  date: string;
  time: string;
  startsAt: string;
  mode: ViewingMode;
  clientName: string;
  newFromApp: boolean;
  property: PropertyCard;
};

/** `GET /v1/agent/today`. `won` counts deals moved to Won this month (Cairo time). */
export type AgentToday = {
  firstNameAr: string;
  firstNameEn: string;
  stats: { today: number; fresh: number; active: number };
  target: { won: number; target: number; teamAvg: number };
  today: AgentViewing[];
  upcoming: AgentViewing[];
  pipeline: Record<LeadStage, number>;
  firstCall: LeadCard[];
};

export type LeadNote = { id: number; text: string; createdAt: string };

/** `GET /v1/agent/leads/:id`: the phone in full, for calling. Opening it marks the lead as seen. */
export type LeadDetail = Omit<LeadCard, 'property'> & {
  property: PropertyCard | null;
  /** The client's next live viewing with this agent, or else the last one. */
  viewing: AgentViewing | null;
  notes: LeadNote[];
  /** The latest conversation with this client, for the Chat button. */
  chatId: number | null;
  createdAt: string;
};

/** `PATCH /v1/agent/leads/:id`. */
export type UpdateLeadBody = { stage?: LeadStage; hot?: boolean };

/** `POST /v1/agent/leads/:id/notes`. */
export type AddLeadNoteBody = { text: string };

export const LEAD_NOTE_MAX = 1000;

// Live chat (contract §8.12, §10.3). One conversation per client and home, with that home's advisor.

/**
 * What a message carries. Cards about the home (`property`, `tour`) show the conversation's home;
 * `plan` keeps the plan as it was sent. `auto` marks the out-of-hours reply (contract §16.1 #12).
 */
export type ChatBody =
  | { kind: 'text'; text: string; auto?: boolean }
  | { kind: 'images'; urls: string[] }
  | { kind: 'property' }
  | { kind: 'plan'; price: number; downPct: number; years: number; monthly: number }
  | { kind: 'tour' }
  | { kind: 'slots'; date: string; times: string[]; chosen: string | null }
  | { kind: 'booking'; viewingId: number; date: string; time: string };

export type ChatMessage = {
  id: number;
  threadId: number;
  sender: ChatSender;
  body: ChatBody;
  /** When the other side read it. */
  readAt: string | null;
  createdAt: string;
};

/** A conversation as the lists and the screen's header show it. `unread` counts the other side's unread messages. */
export type ChatThread = {
  id: number;
  property: PropertyCard;
  agent: ListingAgent;
  /** For the agent: who they are talking to (empty name for a deleted account). */
  client: { name: string; phone: string | null } | null;
  leadId: number | null;
  last: ChatMessage | null;
  unread: number;
};

/** `GET /v1/chats/:id/messages?before=`: oldest first; `hasMore` when older ones are left. */
export type ChatPage = { items: ChatMessage[]; hasMore: boolean };

/** `POST /v1/chats/:id/messages`: clients send text; agents also send cards. Photos go to `/images`. */
export type SendChatBody =
  | { kind: 'text'; text: string }
  | { kind: 'property' }
  | { kind: 'plan' }
  | { kind: 'tour' }
  | { kind: 'slots'; date: string };

export const CHAT_TEXT_MAX = 2000;
export const CHAT_PAGE = 30;
/** Photos in one message. */
export const CHAT_IMAGES_MAX = 4;

/** Socket.IO events from the server (the client sends `open` and `typing`). */
export type ChatEvents = {
  message: { message: ChatMessage };
  read: { threadId: number; reader: ChatSender; at: string };
  typing: { threadId: number; sender: ChatSender };
  /** A slots card changed (the client picked a time). */
  updated: { message: ChatMessage };
};
