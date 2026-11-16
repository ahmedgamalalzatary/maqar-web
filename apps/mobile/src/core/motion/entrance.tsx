import { type ComponentProps, type ReactNode, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { EASE_OUT } from './motion';

/** How many rows rise in; the rest are already in place. */
export const ENTRANCE_MAX = 6;
/** Rows that mount this long after the first one don't animate (scrolled to, or remounted). */
export const ENTRANCE_WINDOW_MS = 700;
const STAGGER_MS = 45;

export type EntranceClock = { start: number };

/** One per list: when its first row showed. */
export const entranceClock = (): EntranceClock => ({ start: 0 });

/** Whether row `index` rises in, mounting at `now`. The first row to ask starts the clock. */
export function entersNow(clock: EntranceClock, index: number, reduced: boolean, now: number): boolean {
  if (reduced || index >= ENTRANCE_MAX) return false;
  if (!clock.start) clock.start = now;
  return now - clock.start < ENTRANCE_WINDOW_MS;
}

/** A list's clock; pass it to each row's `Entrance`. */
export function useEntranceClock(): EntranceClock {
  const [clock] = useState(entranceClock);
  return clock;
}

/**
 * Wraps a row so the first few rise in one after another when the list first shows (2026-11-16).
 * The choice is made once, when the row mounts, so a list re-rendering or scrolling never replays it.
 */
export function Entrance({
  clock,
  index,
  exiting,
  style,
  children,
}: {
  clock: EntranceClock;
  index: number;
  /** How the row leaves when it is taken out of the list. */
  exiting?: ComponentProps<typeof Animated.View>['exiting'];
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReduceMotion();
  const [entering] = useState(() =>
    entersNow(clock, index, reduced, Date.now()) ? FadeInDown.duration(260).delay(index * STAGGER_MS).easing(EASE_OUT) : undefined,
  );
  return (
    <Animated.View entering={entering} exiting={exiting} style={style}>
      {children}
    </Animated.View>
  );
}
