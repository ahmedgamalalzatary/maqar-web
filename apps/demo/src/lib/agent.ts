"use client";

import { useMemo } from "react";
import { PROPERTIES, type Bi } from "./data";
import { useStore, type LeadStage } from "./store";
import { toISODate } from "./logic";

export type Lead = {
  id: string;
  name: Bi;
  phone: string;
  propertyId: string;
  budget: number;
  source: Bi;
  stage: LeadStage;
  lastAt: number;
  viewing?: { date: string; time: string; mode: "visit" | "video" };
  hot?: boolean;
  fromApp?: boolean;
};

export const STAGES: { k: LeadStage; label: Bi; tone: string }[] = [
  { k: "new", label: { ar: "جديد", en: "New" }, tone: "#b38959" },
  { k: "contacted", label: { ar: "تم التواصل", en: "Contacted" }, tone: "#3d5a80" },
  { k: "viewing", label: { ar: "معاينة", en: "Viewing" }, tone: "#61766d" },
  { k: "negotiation", label: { ar: "تفاوض", en: "Negotiation" }, tone: "#8c5e58" },
  { k: "won", label: { ar: "تم البيع", en: "Won" }, tone: "#3f7d5c" },
  { k: "lost", label: { ar: "مغلق", en: "Lost" }, tone: "#8a929a" },
];

const H = 3600_000;
const day = (n: number) => toISODate(new Date(Date.now() + n * 86_400_000));

const BASE: Lead[] = [
  { id: "l1", name: { ar: "كريم محمود", en: "Karim Mahmoud" }, phone: "+20 101 *** 4412", propertyId: "m101", budget: 25_000_000, source: { ar: "حجز من التطبيق", en: "Booked in app" }, stage: "viewing", lastAt: Date.now() - 2 * H, viewing: { date: day(0), time: "16:00", mode: "visit" }, hot: true },
  { id: "l2", name: { ar: "نهى السيد", en: "Noha El Sayed" }, phone: "+20 112 *** 9087", propertyId: "m102", budget: 8_000_000, source: { ar: "جولة ٣٦٠°", en: "360° tour" }, stage: "new", lastAt: Date.now() - 0.4 * H, hot: true },
  { id: "l3", name: { ar: "طارق عبد الله", en: "Tarek Abdallah" }, phone: "+20 100 *** 2231", propertyId: "m107", budget: 17_000_000, source: { ar: "تنبيه سعر", en: "Price alert" }, stage: "negotiation", lastAt: Date.now() - 26 * H },
  { id: "l4", name: { ar: "دينا رأفت", en: "Dina Raafat" }, phone: "+20 122 *** 6540", propertyId: "m109", budget: 13_000_000, source: { ar: "ترشيح ذكي", en: "Smart pick" }, stage: "contacted", lastAt: Date.now() - 5 * H, viewing: { date: day(1), time: "12:00", mode: "video" } },
  { id: "l5", name: { ar: "محمد فتحي", en: "Mohamed Fathy" }, phone: "+20 109 *** 7718", propertyId: "m101", budget: 22_000_000, source: { ar: "حجز من التطبيق", en: "Booked in app" }, stage: "viewing", lastAt: Date.now() - 8 * H, viewing: { date: day(0), time: "19:00", mode: "visit" } },
  { id: "l6", name: { ar: "ياسمين حسني", en: "Yasmin Hosny" }, phone: "+20 111 *** 3390", propertyId: "m102", budget: 7_500_000, source: { ar: "حاسبة التقسيط", en: "Calculator" }, stage: "won", lastAt: Date.now() - 72 * H },
  { id: "l7", name: { ar: "أحمد سمير", en: "Ahmed Samir" }, phone: "+20 106 *** 5521", propertyId: "m113", budget: 10_000_000, source: { ar: "إعلان مالك", en: "Owner listing" }, stage: "new", lastAt: Date.now() - 1.2 * H },
  { id: "l8", name: { ar: "هالة منصور", en: "Hala Mansour" }, phone: "+20 127 *** 8804", propertyId: "m109", budget: 12_000_000, source: { ar: "حجز من التطبيق", en: "Booked in app" }, stage: "lost", lastAt: Date.now() - 120 * H },
];

/** Agent's leads = seeded leads + every viewing the demo client booked in the buyer app. */
export function useLeads(): Lead[] {
  const stages = useStore((s) => s.leadStages);
  const viewings = useStore((s) => s.viewings);
  const name = useStore((s) => s.name);
  return useMemo(() => {
    const fromApp: Lead[] = viewings
      .filter((v) => v.status !== "cancelled" && PROPERTIES.some((p) => p.id === v.propertyId))
      .map((v) => ({
        id: `v-${v.id}`,
        name: { ar: name ? `${name} (أنت)` : "أنت (عميل الديمو)", en: name ? `${name} (you)` : "You (demo client)" },
        phone: "+20 10* *** ****",
        propertyId: v.propertyId,
        budget: useStore.getState().prefs.budgetMax,
        source: { ar: "حجز من التطبيق", en: "Booked in app" },
        stage: "viewing" as LeadStage,
        lastAt: v.createdAt,
        viewing: { date: v.date, time: v.time, mode: v.mode },
        hot: true,
        fromApp: true,
      }));
    return [...fromApp, ...BASE].map((l) => ({ ...l, stage: stages[l.id] ?? l.stage }));
  }, [stages, viewings, name]);
}

export const ME_AGENT = "a1";
