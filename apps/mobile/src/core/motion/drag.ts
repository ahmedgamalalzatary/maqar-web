/**
 * Drag helpers (2026-11-16): where a flick was going, and resistance past an edge. They run on the
 * UI thread inside gesture handlers, so each is a worklet.
 */

/** Where the finger would come to rest if it kept slowing down (Apple's decay form). */
export function projected(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past the edge, the less the thing follows the finger. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Whether letting go here closes it: going down past 40% of the way, counting the flick's speed. */
export function shouldDismiss(translation: number, velocity: number, height: number): boolean {
  'worklet';
  return velocity > -200 && translation + projected(velocity) > height * 0.4;
}
