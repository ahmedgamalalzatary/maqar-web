import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export type Rect = { x: number; y: number; width: number; height: number };
/** Where a page grew from: the card's place on screen, its corner and its photo. */
export type Origin = { rect: Rect; radius: number; cover: string | null };

/** An origin older than this belongs to a press that never became a tap (a scroll, a long press). */
const FRESH_MS = 2000;

/**
 * The card a page is opening from, by page key (2026-11-16). The card measures itself as the
 * finger lands (press-in), before the tap opens the page; the page reads it once, grows out of that
 * rectangle, and shrinks back into it when it closes. A page opened any other way (a link, a
 * notification) finds nothing and fades in.
 */
const origins = new Map<string, Origin & { at: number }>();

export function setOrigin(key: string, origin: Origin, now = Date.now()) {
  origins.set(key, { ...origin, at: now });
}

const fresh = (key: string, now: number) => {
  const o = origins.get(key);
  return o && now - o.at < FRESH_MS ? o : null;
};

/** Reads and forgets: a later visit to the same page from elsewhere must not grow from an old card. */
export function takeOrigin(key: string, now = Date.now()): Origin | null {
  const o = fresh(key, now);
  origins.delete(key);
  return o ? { rect: o.rect, radius: o.radius, cover: o.cover } : null;
}

/** Peeks without forgetting (the page's loading shape shows the card's photo). */
export const peekOrigin = (key: string, now = Date.now()): Origin | null => fresh(key, now);

/** Measures `ref` on screen and records it as `key`'s origin. Call it on press-in. */
export function rememberOrigin(ref: RefObject<ComponentRef<typeof View> | null>, key: string, extra: Omit<Origin, 'rect'>) {
  ref.current?.measureInWindow?.((x, y, width, height) => {
    if (width > 0 && height > 0) setOrigin(key, { rect: { x, y, width, height }, ...extra });
  });
}

export const propertyKey = (id: number) => `property-${id}`;
