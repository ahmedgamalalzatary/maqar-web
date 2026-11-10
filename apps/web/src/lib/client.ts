"use client";

import type { AuthResponse } from "@maqar/shared";
import { useSyncExternalStore } from "react";
import { createApi, type TokenStore } from "./api";

/** The API's `/v1`. In production the dashboard is on the API's host, so the same origin. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/v1";

/** Full URL of a photo path from the API (`/uploads/...`). */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return API_URL.startsWith("http") ? new URL(path, API_URL).toString() : path;
}

const KEY = "maqar-admin-session";
const listeners = new Set<() => void>();
let cached: AuthResponse | null | undefined;

/** The session lives in localStorage, so a reload keeps the admin signed in. */
const store: TokenStore = {
  load: () => {
    if (cached !== undefined) return cached;
    if (typeof window === "undefined") return null;
    try {
      cached = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as AuthResponse | null;
    } catch {
      cached = null;
    }
    return cached;
  },
  save: (auth) => {
    cached = auth;
    try {
      if (auth) window.localStorage.setItem(KEY, JSON.stringify(auth));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Private windows may refuse storage; the session then lasts for this page only.
    }
    for (const l of listeners) l();
  },
};

export const api = createApi({ base: API_URL, fetch: (...a) => fetch(...a), store });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The signed-in admin, or null. Undefined while the page has not read storage yet. */
export function useSession(): AuthResponse | null | undefined {
  return useSyncExternalStore(subscribe, store.load, () => undefined);
}
