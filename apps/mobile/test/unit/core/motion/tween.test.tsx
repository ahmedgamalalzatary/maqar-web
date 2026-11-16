import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { TWEEN_MS, tweenAt, useTweenedNumber } from '@/core/motion/tween';

describe('tweenAt', () => {
  it('starts at the old number and ends on the new one', () => {
    expect(tweenAt(100, 200, 0)).toBe(100);
    expect(tweenAt(100, 200, 1)).toBe(200);
    expect(tweenAt(100, 200, 5)).toBe(200);
  });

  it('moves fast first and settles gently (ease-out)', () => {
    const half = tweenAt(0, 100, 0.5);
    expect(half).toBeGreaterThan(50);
    expect(half).toBeLessThan(100);
    expect(tweenAt(0, 100, 0.25)).toBeLessThan(half);
  });
});

describe('useTweenedNumber', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the first number at once, then counts to a new one', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: number }) => useTweenedNumber(v), { initialProps: { v: 1000 } });
    expect(result.current).toBe(1000);

    await rerender({ v: 2000 });
    await act(async () => {
      jest.advanceTimersByTime(TWEEN_MS / 3);
    });
    expect(result.current).toBeGreaterThan(1000);
    expect(result.current).toBeLessThan(2000);

    await act(async () => {
      jest.advanceTimersByTime(TWEEN_MS);
    });
    expect(result.current).toBe(2000);
  });

  it('jumps straight to the new number when the phone asks for less motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result, rerender } = await renderHook(({ v }: { v: number }) => useTweenedNumber(v), { initialProps: { v: 1 } });
    await act(async () => {});
    await rerender({ v: 9 });
    expect(result.current).toBe(9);
  });
});
