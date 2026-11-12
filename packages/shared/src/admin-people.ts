import type { Page } from './api.js';
import type { Lang, LeadStage, ViewingStatus } from './enums.js';
import type { AdminAgent } from './listings.js';
import type { Prefs } from './match.js';

// ---- Admin: clients and admin accounts (phase 22) ----
// A suspended account is refused everywhere at once, like a turned-off agent. Clients and admins
// are suspended through `users.suspended_at`; agents keep their own on/off switch.

export const CLIENT_STATUSES = ['active', 'suspended'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** A home as the admin people pages show it. */
export type AdminHomeRef = { id: number; titleAr: string; titleEn: string };

/** A row of `GET /admin/clients`. `lastSeenAt` is the last sign-in or session refresh. */
export type AdminClientItem = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  lang: Lang;
  createdAt: string;
  suspendedAt: string | null;
  lastSeenAt: string | null;
  saved: number;
  viewings: number;
  chats: number;
  leads: number;
};

/** `GET /admin/clients`: a page, plus how many clients are active and suspended. */
export type AdminClientsPage = Page<AdminClientItem> & { counts: Record<ClientStatus, number> };

/** `GET /admin/clients/:id`: the row, their preferences, and their latest viewings, chats and leads. */
export type AdminClientDetail = AdminClientItem & {
  prefs: Prefs | null;
  recentViewings: { id: number; startsAt: string; status: ViewingStatus; property: AdminHomeRef; agent: AdminAgent }[];
  threads: { id: number; property: AdminHomeRef; agent: AdminAgent; lastMessageAt: string | null; messages: number }[];
  leadsList: { id: number; stage: LeadStage; property: AdminHomeRef | null; agent: AdminAgent; lastActivityAt: string }[];
};

/** `PATCH /admin/clients/:id`: a new password to pass on (signs them out everywhere), or suspend/restore. */
export type ClientUpdateBody = { password?: string; suspended?: boolean };

/** The answer to a suspension says how many upcoming viewings were cancelled. */
export type ClientUpdateResult = AdminClientDetail & { cancelledViewings: number };

/** A row of `GET /admin/admins`. `you` marks the admin asking. */
export type AdminAccount = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  suspendedAt: string | null;
  lastSeenAt: string | null;
  you: boolean;
};

/** `POST /admin/admins`: a new admin with a starting password to pass on. */
export type AdminAccountBody = { name: string; email: string; phone?: string | null; password: string };

/** `PATCH /admin/admins/:id`. An admin cannot suspend themselves, so one admin always stays active. */
export type AdminAccountUpdate = Partial<AdminAccountBody> & { suspended?: boolean };
