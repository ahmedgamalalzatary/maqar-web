import type { AreaItem, LeadCard } from './api.js';
import type { AdminAgent } from './listings.js';

// ---- Admin tools (phase 18): agents, their hours and days off, leads, areas ----

/** One weekday of an agent's hours: the first and last hour a viewing can start (0 = Sunday). */
export type DayHours = { weekday: number; from: number; to: number };

/** The longest stretch of days off added at once. */
export const DAYS_OFF_MAX = 60;

/** An area's id from its English name: "New Cairo" → "new-cairo". Empty when nothing Latin is left. */
export function areaSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Every calendar day from `from` to `to` (YYYY-MM-DD, both included); empty if backwards or over the limit. */
export function daysBetween(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const n = Math.round((end - start) / 86_400_000) + 1;
  if (n < 1 || n > DAYS_OFF_MAX) return [];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  });
}

/** What is wrong with a week of hours, or null. A weekday left out is a day off. */
export function weekProblem(week: DayHours[]): 'twice' | 'order' | 'range' | null {
  const seen = new Set<number>();
  for (const d of week) {
    if (![d.weekday, d.from, d.to].every(Number.isInteger) || d.weekday < 0 || d.weekday > 6 || d.from < 0 || d.to > 23) return 'range';
    if (d.from > d.to) return 'order';
    if (seen.has(d.weekday)) return 'twice';
    seen.add(d.weekday);
  }
  return null;
}

/** `GET /admin/agents`: every agent, active ones first. */
export type AdminAgentItem = AdminAgent & {
  email: string | null;
  phone: string;
  roleTitleAr: string;
  roleTitleEn: string;
  active: boolean;
  /** Live listings they are the advisor of. */
  live: number;
  /** Leads not won or lost yet. */
  openLeads: number;
  monthlyTarget: number;
};

/** `GET /admin/agents/:id`: the profile, the week and the days off from today. */
export type AdminAgentDetail = AdminAgentItem & {
  languagesAr: string;
  languagesEn: string;
  years: number;
  /** The week as set, or the default week when none is set (`defaultHours`). */
  hours: DayHours[];
  defaultHours: boolean;
  daysOff: { date: string; reason: string | null }[];
};

/** `POST /admin/agents` (with a starting password) and `PATCH /admin/agents/:id` (any field). */
export type AgentBody = {
  nameAr: string;
  nameEn: string;
  email: string;
  password?: string;
  phone: string;
  roleTitleAr: string;
  roleTitleEn: string;
  languagesAr: string;
  languagesEn: string;
  colour: string;
  monthlyTarget: number;
  years?: number;
  active?: boolean;
};

/** `PUT /admin/agents/hours`: the same week for one agent or several. */
export type HoursBody = { agentIds: number[]; hours: DayHours[] };

/** `POST /admin/agents/days-off`: a day or a stretch of days off for one agent or several. */
export type DaysOffBody = { agentIds: number[]; from: string; to?: string; reason?: string };

/** Viewings already booked on the new days off: they stay, so the admin can move them. */
export type DaysOffResult = { days: number; booked: { agentId: number; viewings: number }[] };

/** `GET /admin/leads`: every agent's leads, with whose they are. */
export type AdminLeadItem = Omit<LeadCard, 'isNew'> & { agent: AdminAgent };

/** `PATCH /admin/leads/:id/assign`. */
export type AssignLeadBody = { agentId: number };

/** `GET /admin/areas`: areas with how many listings use them (an area in use cannot be deleted). */
export type AdminArea = AreaItem & { listings: number };

/** `POST /admin/areas` (the id is made from the English name when left out) and `PATCH /admin/areas/:id`. */
export type AreaBody = { id?: string; nameAr: string; nameEn: string; cityAr: string; cityEn: string; image: string };
