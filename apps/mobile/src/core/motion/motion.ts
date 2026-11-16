import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens (2026-11-16). UI motion stays under 300ms; anything a finger moves settles with a
 * spring that carries the finger's speed. Screen-to-screen motion is the platform's own.
 */
/** Strong ease-out: entering, leaving, and anything the eye is waiting for. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Moving across the screen. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** The same ease-out for Reanimated CSS transitions. */
export const CSS_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

export const PRESS_MS = 120;
/** A sheet or a photo let go of: settles without bouncing past where it goes. */
export const SETTLE = { duration: 300, dampingRatio: 0.8 } as const;
/** Something landing: a little overshoot. */
export const BOUNCE = { duration: 450, dampingRatio: 0.5 } as const;
