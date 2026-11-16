import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { EASE_OUT } from './motion';

/** How many rows rise in; the rest are already in place. */
export const ENTRANCE_MAX = 6;
/** Rows that mount this long after the first one don't animate (scrolled to, or remounted). */
export const ENTRANCE_WINDOW_MS = 700;
const STAGGER_MS = 45;
const REVEAL_MS = 300;

export type EntranceClock = {
  start: number;
  /** Rows (by key) already seen, so scrolling back never replays them. */
  seen: Set<string>;
  /** Rows waiting off screen to rise in when they first scroll into view. */
  waiting: Map<string, () => void>;
};

/** One per list: when its first row showed. */
export const entranceClock = (): EntranceClock => ({ start: 0, seen: new Set(), waiting: new Map() });

/** Whether row `index` rises in, mounting at `now`. The first row to ask starts the clock. */
export function entersNow(clock: EntranceClock, index: number, reduced: boolean, now: number): boolean {
  if (reduced || index >= ENTRANCE_MAX) return false;
  if (!clock.start) clock.start = now;
  return now - clock.start < ENTRANCE_WINDOW_MS;
}

/**
 * Rows that came into view: those still waiting rise in now, and every one is marked seen.
 * Hand it to the list's `onViewableItemsChanged`.
 */
export function revealRows(clock: EntranceClock, keys: string[]) {
  for (const key of keys) {
    clock.seen.add(key);
    const rise = clock.waiting.get(key);
    clock.waiting.delete(key);
    rise?.();
  }
}

/** A list's clock; pass it to each row's `Entrance`. */
export function useEntranceClock(): EntranceClock {
  const [clock] = useState(entranceClock);
  return clock;
}

/** The list props that let rows rise in as they scroll into view (2026-11-16). */
export function useRevealOnScroll(clock: EntranceClock) {
  const [props] = useState(() => ({
    viewabilityConfig: { itemVisiblePercentThreshold: 15 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: { key: string }[] }) => revealRows(clock, viewableItems.map((v) => String(v.key))),
  }));
  return props;
}

/**
 * Wraps a row so the first few rise in one after another when the list first shows (2026-11-16).
 * With `id` (and the list's `useRevealOnScroll`), a row further down waits out of sight and rises
 * in the first time it scrolls into view. The choice is made once, when the row mounts, so a list
 * re-rendering, or scrolling back, never replays it.
 */
export function Entrance({
  clock,
  index,
  id,
  exiting,
  style,
  children,
}: {
  clock: EntranceClock;
  index: number;
  /** The row's list key: turns on rising in on scroll. */
  id?: string;
  /** How the row leaves when it is taken out of the list. */
  exiting?: ComponentProps<typeof Animated.View>['exiting'];
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReduceMotion();
  const [mode] = useState<'stagger' | 'wait' | 'still'>(() => {
    if (entersNow(clock, index, reduced, Date.now())) {
      if (id) clock.seen.add(id);
      return 'stagger';
    }
    return id && !reduced && !clock.seen.has(id) ? 'wait' : 'still';
  });
  const [entering] = useState(() => (mode === 'stagger' ? FadeInDown.duration(260).delay(index * STAGGER_MS).easing(EASE_OUT) : undefined));
  const shown = useSharedValue(mode === 'wait' ? 0 : 1);

  useEffect(() => {
    if (mode !== 'wait' || !id) return;
    const rise = () => shown.set(withTiming(1, { duration: REVEAL_MS, easing: EASE_OUT }));
    if (clock.seen.has(id)) return rise();
    clock.waiting.set(id, rise);
    return () => {
      clock.waiting.delete(id);
    };
  }, [mode, id, clock, shown]);

  const rising = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: 18 * (1 - shown.get()) }] }));

  return (
    <Animated.View entering={entering} exiting={exiting} style={[style, mode === 'wait' ? rising : null]}>
      {children}
    </Animated.View>
  );
}
