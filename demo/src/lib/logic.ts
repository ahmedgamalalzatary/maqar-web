"use client";

import { useEffect, useMemo, useState } from "react";
import { PROPERTIES, type Property, type Bi } from "./data";
import { useStore, type Prefs, type OwnerListing } from "./store";

/** Static listings plus approved owner listings, with live price drops applied. */
export function useProperties(): Property[] {
  const overrides = useStore((s) => s.priceOverrides);
  const owner = useStore((s) => s.ownerListings);
  return useMemo(() => {
    const fromOwner = owner.filter((o) => o.status === "approved").map(ownerToProperty);
    return [...fromOwner, ...PROPERTIES].map((p) =>
      overrides[p.id] ? { ...p, price: overrides[p.id].price, oldPrice: overrides[p.id].oldPrice } : p,
    );
  }, [overrides, owner]);
}

export function useProperty(id: string) {
  const all = useProperties();
  return all.find((p) => p.id === id);
}

export function ownerToProperty(o: OwnerListing): Property {
  return {
    id: o.id,
    cat: o.cat,
    type: o.type,
    title: { ar: o.title, en: o.title },
    areaId: o.areaId,
    compound: { ar: "إعلان مالك موثّق", en: "Verified owner listing" },
    price: o.price,
    beds: o.beds,
    baths: o.baths,
    size: o.size,
    finishing: o.finishing,
    delivery: "ready",
    images: o.images,
    agentId: "a1",
    views: o.views,
    interested: o.interested,
    features: o.features,
    listedDays: 0,
    desc: {
      ar: "إعلان أضافه المالك وراجعه فريق مقر قبل النشر.",
      en: "Listed by the owner and reviewed by the Maqar team before going live.",
    },
    ownerId: "me",
  };
}

export type Match = { score: number; reasons: Bi[] };

/** Simple, explainable recommendation score from 0 to 100. */
export function matchScore(p: Property, prefs: Prefs, areaName: (id: string) => Bi): Match {
  let score = 40;
  const reasons: Bi[] = [];
  // A renter's budget is monthly; everyone else's is a purchase budget.
  const monthly = prefs.purpose[0] === "rent";
  const effPrice =
    p.cat === "rent"
      ? monthly ? p.price : p.price * 144
      : p.cat === "stay"
        ? monthly ? p.price * 4 : p.price * 300
        : p.price;

  if (prefs.purpose.includes(p.cat)) score += 14;
  if (effPrice <= prefs.budgetMax) {
    score += 18;
    reasons.push({ ar: "ضمن ميزانيتك", en: "Within budget" });
  } else if (effPrice <= prefs.budgetMax * 1.15) {
    score += 6;
    reasons.push({ ar: "قريب من ميزانيتك", en: "Near your budget" });
  } else score -= 18;

  if (prefs.areas.length === 0 || prefs.areas.includes(p.areaId)) {
    score += prefs.areas.length ? 14 : 4;
    if (prefs.areas.length) reasons.push(areaName(p.areaId));
  }
  if (prefs.types.includes(p.type)) score += 8;
  if (prefs.beds && p.beds >= prefs.beds) score += 4;
  const hits = p.features.filter((f) => prefs.interests.includes(f));
  score += Math.min(12, hits.length * 4);
  if (p.plan && prefs.interests.length) {
    score += 2;
  }
  if (p.tour) score += 2;
  return { score: Math.max(32, Math.min(99, Math.round(score))), reasons: reasons.slice(0, 2) };
}

/** Monthly installment for a payment plan (developer plans are usually 0% interest). */
export function installment(price: number, downPct: number, years: number, ratePct = 0, quarterly = false) {
  const down = (price * downPct) / 100;
  const principal = price - down;
  const perYear = quarterly ? 4 : 12;
  const n = Math.max(1, Math.round(years * perYear));
  const r = ratePct / 100 / perYear;
  const pay = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  return { down, principal, n, pay, total: down + pay * n };
}

/** Deterministic availability so slots look real but stay stable between renders. */
export function slotTaken(seed: string, date: string, time: string) {
  let h = 0;
  for (const c of seed + date + time) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 5 === 0;
}

export const SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function viewingDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

export function icsFor(title: string, start: Date, location: string, desc: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(start.getTime() + 45 * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Maqar//Demo//EN",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}@maqar.demo`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${desc}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadText(name: string, text: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Current time that refreshes on an interval, safe to read during render. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
