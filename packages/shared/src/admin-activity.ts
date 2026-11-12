import type { ChatBlock, ChatMessage, ChatReportReason, Page } from './api.js';
import type { ChatSender, ViewingStatus } from './enums.js';
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

// ---- Admin: chats and reports (phase 24) ----

/** A row of `GET /admin/chats`. */
export type AdminChatItem = {
  id: number;
  property: AdminHomeRef;
  agent: AdminAgent;
  /** Null once the client deleted the account. */
  client: { id: number; name: string; phone: string | null } | null;
  last: ChatMessage | null;
  messages: number;
  blocked: ChatBlock | null;
  openReports: number;
  createdAt: string;
};

export type AdminChatsPage = Page<AdminChatItem>;

export const REPORT_OUTCOMES = ['dismissed', 'blocked', 'suspended'] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

/** A report on a conversation. `outcome` and `resolvedAt` stay null while it is open. */
export type ChatReport = {
  id: number;
  threadId: number;
  by: ChatSender;
  reporter: { id: number; name: string } | null;
  reason: ChatReportReason;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  outcome: ReportOutcome | null;
  resolvedBy: { id: number; name: string } | null;
};

/** `GET /admin/chats/:id`: the conversation and every report on it, newest first. */
export type AdminChatDetail = AdminChatItem & { reports: ChatReport[] };

/** A row of `GET /admin/reports`: the report and its conversation. */
export type AdminReportItem = ChatReport & { chat: AdminChatItem };

/** `PATCH /admin/reports/:id`: dismiss it, close the conversation, or suspend the client (phase 22's suspension). */
export type ReportResolveBody = { outcome: ReportOutcome };
