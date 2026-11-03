"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bi, Category, Feature, PropType, Finishing } from "./data";

export type Lang = "ar" | "en";
export type Role = "buyer" | "owner" | "agent";
export type ReminderKey = "1d" | "2h" | "30m";
export type ViewingMode = "visit" | "video";
export type ViewingStatus = "confirmed" | "rescheduled" | "cancelled" | "completed";

export type Prefs = {
  purpose: Category[];
  budgetMax: number;
  areas: string[];
  types: PropType[];
  beds: number;
  interests: Feature[];
};

export type Viewing = {
  id: string;
  propertyId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  mode: ViewingMode;
  agentId: string;
  status: ViewingStatus;
  reminders: ReminderKey[];
  createdAt: number;
  rescheduledFrom?: string;
};

export type NotifKind = "price" | "reminder" | "booking" | "approval" | "match" | "lead";
export type Notif = {
  id: string;
  kind: NotifKind;
  title: Bi;
  body: Bi;
  at: number;
  read: boolean;
  href?: string;
};

export type OwnerListing = {
  id: string;
  cat: Category;
  type: PropType;
  title: string;
  areaId: string;
  price: number;
  beds: number;
  baths: number;
  size: number;
  finishing: Finishing;
  features: Feature[];
  images: string[];
  status: "pending" | "approved" | "changes";
  createdAt: number;
  views: number;
  interested: number;
  saves: number;
};

export type LeadStage = "new" | "contacted" | "viewing" | "negotiation" | "won" | "lost";

export type Toast = { id: string; title: string; body?: string; tone?: "gold" | "sage" | "danger"; href?: string };

type State = {
  lang: Lang;
  theme: "light" | "dark";
  role: Role;
  name: string;
  onboarded: boolean;
  prefs: Prefs;
  favorites: string[];
  alerts: string[];
  priceOverrides: Record<string, { price: number; oldPrice: number }>;
  viewings: Viewing[];
  notifications: Notif[];
  ownerListings: OwnerListing[];
  leadStages: Record<string, LeadStage>;
  leadNotes: Record<string, string[]>;
  toasts: Toast[];

  set: (p: Partial<State>) => void;
  completeOnboarding: (name: string, prefs: Prefs) => void;
  toggleFavorite: (id: string) => boolean;
  toggleAlert: (id: string) => boolean;
  dropPrice: (id: string, base: number, pct: number) => void;
  addViewing: (v: Omit<Viewing, "createdAt">) => void;
  updateViewing: (id: string, patch: Partial<Viewing>) => void;
  notify: (n: Omit<Notif, "id" | "at" | "read">) => void;
  markAllRead: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  addOwnerListing: (l: OwnerListing) => void;
  updateOwnerListing: (id: string, patch: Partial<OwnerListing>) => void;
  setLeadStage: (id: string, s: LeadStage) => void;
  addLeadNote: (id: string, note: string) => void;
  resetDemo: () => void;
};

export const uid = () => Math.random().toString(36).slice(2, 9);

const DAY = 86_400_000;

const seedNotifications = (): Notif[] => [
  {
    id: "n-seed-1",
    kind: "price",
    title: { ar: "السعر نزل ٦٪", en: "Price dropped 6%" },
    body: { ar: "شاليه صف أول على البحر في أزور باي أصبح ١١٫٢ مليون ج.م", en: "First-row chalet in Azure Bay is now EGP 11.2M" },
    at: Date.now() - 3 * 3600_000,
    read: false,
    href: "/property/m104",
  },
  {
    id: "n-seed-2",
    kind: "match",
    title: { ar: "٣ وحدات جديدة تناسبك", en: "3 new homes match you" },
    body: { ar: "اخترناها بناءً على ميزانيتك والمناطق اللي بتدور فيها", en: "Picked from your budget and the areas you search" },
    at: Date.now() - DAY,
    read: false,
    href: "/explore?for=you",
  },
];

const initial = {
  lang: "ar" as Lang,
  theme: "light" as const,
  role: "buyer" as Role,
  name: "",
  onboarded: false,
  prefs: { purpose: ["sale"], budgetMax: 12_000_000, areas: [], types: [], beds: 0, interests: [] } as Prefs,
  favorites: ["m104", "m109"],
  alerts: ["m104", "m109"],
  priceOverrides: {},
  viewings: [] as Viewing[],
  notifications: seedNotifications(),
  ownerListings: [] as OwnerListing[],
  leadStages: {},
  leadNotes: {},
  toasts: [] as Toast[],
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (p) => set(p),
      completeOnboarding: (name, prefs) => set({ name, prefs, onboarded: true }),
      toggleFavorite: (id) => {
        const on = !get().favorites.includes(id);
        set({ favorites: on ? [id, ...get().favorites] : get().favorites.filter((f) => f !== id) });
        return on;
      },
      toggleAlert: (id) => {
        const on = !get().alerts.includes(id);
        set({ alerts: on ? [id, ...get().alerts] : get().alerts.filter((f) => f !== id) });
        return on;
      },
      dropPrice: (id, base, pct) => {
        const price = Math.round((base * (1 - pct / 100)) / 10_000) * 10_000;
        set({ priceOverrides: { ...get().priceOverrides, [id]: { price, oldPrice: base } } });
      },
      addViewing: (v) => set({ viewings: [{ ...v, createdAt: Date.now() }, ...get().viewings] }),
      updateViewing: (id, patch) =>
        set({ viewings: get().viewings.map((v) => (v.id === id ? { ...v, ...patch } : v)) }),
      notify: (n) =>
        set({ notifications: [{ ...n, id: uid(), at: Date.now(), read: false }, ...get().notifications] }),
      markAllRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),
      toast: (t) => {
        const id = uid();
        set({ toasts: [...get().toasts, { ...t, id }] });
        setTimeout(() => get().dismissToast(id), 4200);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      addOwnerListing: (l) => set({ ownerListings: [l, ...get().ownerListings] }),
      updateOwnerListing: (id, patch) =>
        set({ ownerListings: get().ownerListings.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      setLeadStage: (id, s) => set({ leadStages: { ...get().leadStages, [id]: s } }),
      addLeadNote: (id, note) =>
        set({ leadNotes: { ...get().leadNotes, [id]: [note, ...(get().leadNotes[id] ?? [])] } }),
      resetDemo: () => set({ ...initial, notifications: seedNotifications(), lang: get().lang, theme: get().theme }),
    }),
    {
      name: "maqar-demo",
      version: 1,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, ...rest } = s;
        return rest;
      },
    },
  ),
);

/** Fire a phone notification when the viewer allowed it, and always an in-app toast. */
export function pushNotify(title: string, body?: string, href?: string, tone: Toast["tone"] = "gold") {
  useStore.getState().toast({ title, body, href, tone });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/brand/icon-192.png" });
    }
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
  haptic([12, 40, 12]);
}

export const haptic = (ms: number | number[] = 8) => {
  try {
    // Browsers block vibration until the viewer has tapped the page once.
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (active !== false) navigator.vibrate?.(ms);
  } catch {}
};
