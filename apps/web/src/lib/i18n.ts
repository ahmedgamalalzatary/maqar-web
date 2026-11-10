"use client";

import type { Bi, Lang } from "@maqar/shared";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "maqar-admin-lang";
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return window.localStorage.getItem(KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function setLang(lang: Lang): void {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Storage refused: the choice lasts for this page.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Arabic first (contract §7). The page's lang and direction follow the choice. */
export function useLang(): Lang {
  const lang = useSyncExternalStore(subscribe, read, () => "ar" as const);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  return lang;
}

/** `t('عربي', 'English')` or `t({ ar, en })`. */
export function useT() {
  const lang = useLang();
  return useCallback((ar: string | Bi, en?: string) => (typeof ar === "string" ? (lang === "ar" ? ar : (en ?? ar)) : ar[lang]), [lang]);
}

export type T = ReturnType<typeof useT>;
