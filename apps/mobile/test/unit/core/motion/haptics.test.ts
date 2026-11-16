import * as Haptics from 'expo-haptics';
import { haptic } from '@/core/motion/haptics';

beforeEach(() => jest.clearAllMocks());

// One buzz per moment, chosen by what happened (2026-11-16 motion pass).
it('gives each moment its own buzz', () => {
  haptic.tap();
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  haptic.select();
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  haptic.success();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  haptic.error();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
});

it('stays quiet when the phone cannot buzz', async () => {
  (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('no vibrator'));
  expect(() => haptic.tap()).not.toThrow();
  // The rejected promise is caught, so nothing is left unhandled.
  await Promise.resolve();
});
