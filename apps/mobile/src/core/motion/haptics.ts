import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Fire and forget: a phone without a vibrator (or the web) just stays quiet. */
const run = (buzz: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  try {
    buzz().catch(() => undefined);
  } catch {
    // A missing native module throws before returning a promise.
  }
};

/**
 * The app's haptics (2026-11-16 motion pass). One buzz per thing the person did, in the same frame
 * as what they see, and never the only feedback: many phones have haptics off.
 */
export const haptic = {
  /** Something light was committed: a save, a pick, a sheet settling. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A value ticked over: a choice in a group, an item taken off. */
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
