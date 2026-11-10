// Enums from the contract (§2, §13). Each one is a readonly tuple plus its union type,
// so the API can validate with `IsIn(LIST)` and the app can loop over the values.

export const ROLES = ['client', 'agent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Roles a person can pick at sign-up: clients only. Agents and admins are created by an admin, and
 * there are no owner accounts: owners deal with Maqar, and admins list their homes (2026-11-09).
 */
export const SIGN_UP_ROLES = ['client'] as const satisfies readonly Role[];
export type SignUpRole = (typeof SIGN_UP_ROLES)[number];

export const LANGS = ['ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** `system` follows the phone's setting (the default on first launch). */
export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];

export const CATEGORIES = ['sale', 'rent', 'stay', 'project'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'twinhouse',
  'townhouse',
  'chalet',
  'penthouse',
  'duplex',
  'studio',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FINISHINGS = ['full', 'semi', 'core', 'furnished'] as const;
export type Finishing = (typeof FINISHINGS)[number];

export const FEATURES = [
  'pool',
  'garden',
  'sea',
  'parking',
  'elevator',
  'security',
  'gym',
  'clubhouse',
  'smart',
  'roof',
] as const;
export type Feature = (typeof FEATURES)[number];

export const PROPERTY_STATUSES = [
  'draft',
  'pending',
  'approved',
  'changes',
  'sold',
  'rented',
  'unpublished',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const LEAD_STAGES = ['new', 'contacted', 'viewing', 'negotiation', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Where a lead came from (contract §10.2). Owner listings are gone with the owner role. */
export const LEAD_SOURCES = ['booking', 'tour', 'price_alert', 'smart_pick', 'calculator', 'chat', 'call', 'walk_in'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const VIEWING_MODES = ['visit', 'video'] as const;
export type ViewingMode = (typeof VIEWING_MODES)[number];

export const VIEWING_STATUSES = ['confirmed', 'rescheduled', 'cancelled', 'completed'] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const REMINDER_OFFSETS = ['1d', '2h', '30m'] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/**
 * What a notification is about (contract §8.13). `system` is Maqar's own, such as the one sent when
 * phone notifications are turned on. There is no `approval`: owners have no accounts (2026-11-09).
 */
export const NOTIFICATION_KINDS = ['price', 'reminder', 'booking', 'match', 'lead', 'chat', 'system'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const CHAT_SENDERS = ['client', 'agent'] as const;
export type ChatSender = (typeof CHAT_SENDERS)[number];

export const CHAT_MESSAGE_KINDS = ['text', 'images', 'property', 'plan', 'tour', 'slots', 'booking'] as const;
export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];
