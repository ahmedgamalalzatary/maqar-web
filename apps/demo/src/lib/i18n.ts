"use client";

import { useCallback } from "react";
import { useStore, type Lang } from "./store";
import type { Bi } from "./data";

export function useLang(): Lang {
  return useStore((s) => s.lang);
}

/** t("عربي", "English") or t({ar, en}) */
export function useT() {
  const lang = useLang();
  return useCallback(
    (a: string | Bi, b?: string) => {
      if (typeof a === "object") return a[lang];
      return lang === "ar" ? a : (b ?? a);
    },
    [lang],
  );
}

const loc = (lang: Lang) => (lang === "ar" ? "ar-EG" : "en-GB");

export function fmtNum(n: number, lang: Lang, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(loc(lang), opts).format(n);
}

/** 24500000 → "٢٤٫٥ مليون" / "24.5M" */
export function fmtCompact(n: number, lang: Lang) {
  return new Intl.NumberFormat(loc(lang), {
    notation: "compact",
    maximumFractionDigits: n >= 1_000_000 ? 2 : 0,
  }).format(n);
}

export function fmtMoney(n: number, lang: Lang, compact = true) {
  const v = compact && n >= 100_000 ? fmtCompact(n, lang) : fmtNum(n, lang);
  return lang === "ar" ? `${v} ج.م` : `EGP ${v}`;
}

export function fmtDate(d: Date | string, lang: Lang, opts: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return new Intl.DateTimeFormat(loc(lang), opts).format(date);
}

export function fmtTime(hhmm: string, lang: Lang) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 0, 1, h, m);
  return new Intl.DateTimeFormat(loc(lang), { hour: "numeric", minute: "2-digit" }).format(d);
}

export function relTime(at: number, lang: Lang) {
  const rtf = new Intl.RelativeTimeFormat(loc(lang), { numeric: "auto" });
  const s = Math.round((at - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** 5 → "٥٪" / "5%"; negative values read as a drop: "٦٪-" / "-6%". */
export function fmtPct(n: number, lang: Lang) {
  const v = fmtNum(Math.abs(n), lang);
  if (lang === "ar") return `${v}٪${n < 0 ? "-" : ""}`;
  return `${n < 0 ? "-" : ""}${v}%`;
}
