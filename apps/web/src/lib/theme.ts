"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "maqar-admin-theme";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "dark";
  } catch {
    return false;
  }
}

export function setDark(dark: boolean): void {
  try {
    window.localStorage.setItem(KEY, dark ? "dark" : "light");
  } catch {
    // Storage refused: the choice lasts for this page.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Light by default; the page's `data-theme` follows the admin's choice. */
export function useDark(): boolean {
  const dark = useSyncExternalStore(subscribe, read, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  return dark;
}
