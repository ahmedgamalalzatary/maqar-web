import type { Page } from './api.js';
import type { ViewingStatus } from './enums.js';
import type { AdminHomeRef } from './admin-people.js';
import type { AdminAgent } from './listings.js';

// ---- Admin: viewings (phase 23) ----

/** Upcoming viewings soonest first, past ones latest first. */
export const VIEWING_WHENS = ['upcoming', 'past'] as const;
export type ViewingWhen = (typeof VIEWING_WHENS)[number];

/** A row of `GET /admin/viewings`. `date` and `time` are Cairo's. */
export type AdminViewingItem = {
  id: number;
  status: ViewingStatus;
  date: string;
  time: string;
  startsAt: string;
  rescheduledFrom: { date: string; time: string } | null;
  property: AdminHomeRef;
  agent: AdminAgent;
  /** Null once the client deleted the account. */
  client: { id: number; name: string; phone: string | null; email: string | null } | null;
  createdAt: string;
};

export type AdminViewingsPage = Page<AdminViewingItem>;

/** `PATCH /admin/viewings/:id`: a new time with the same advisor, or a cancellation. The reason goes in both notices. */
export type AdminViewingUpdate = { action: 'cancel'; reason?: string } | { action: 'reschedule'; date: string; time: string; reason?: string };
