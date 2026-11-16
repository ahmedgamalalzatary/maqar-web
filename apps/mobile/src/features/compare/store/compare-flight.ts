import { create } from 'zustand';

/** A flight older than this is dropped: the bar was not on screen to catch it. */
export const FLIGHT_MS = 900;

type Point = { x: number; y: number };
type Origin = Point & { id: number; at: number };

/**
 * Where a home picked to compare took off (2026-11-16): the scale button's centre on screen. The
 * compare bar's new thumbnail starts there and flies into place, once.
 */
export const useCompareFlight = create<{ origin: Origin | null; launch: (id: number, from: Point, now?: number) => void }>((set) => ({
  origin: null,
  launch: (id, from, now = Date.now()) => set({ origin: { ...from, id, at: now } }),
}));

/** Where the thumbnail for `id` flies from, if it was just picked; asking uses it up. */
export function flightFor(id: number, now = Date.now()): Point | null {
  const origin = useCompareFlight.getState().origin;
  if (!origin || origin.id !== id || now - origin.at > FLIGHT_MS) return null;
  useCompareFlight.setState({ origin: null });
  return { x: origin.x, y: origin.y };
}
