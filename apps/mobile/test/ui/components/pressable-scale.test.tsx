import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { renderWithProviders } from '../../utils/render';

const style = () => StyleSheet.flatten(screen.getByRole('button', { name: 'Go' }).props.style);
const scale = () => (style().transform as { scale: number }[] | undefined)?.find((t) => 'scale' in t)?.scale ?? 1;

afterEach(() => jest.restoreAllMocks());

// Every card and button gives under the finger (2026-11-16): feedback on press-in, not on release.
describe('PressableScale', () => {
  it('shrinks a little while pressed and comes back on release', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <PressableScale accessibilityRole="button" accessibilityLabel="Go" onPress={onPress}>
        <Text>Go</Text>
      </PressableScale>,
    );
    expect(scale()).toBe(1);

    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');
    expect(scale()).toBe(0.97);

    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressOut');
    expect(scale()).toBe(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('dims instead of shrinking when the phone asks for less motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderWithProviders(
      <PressableScale accessibilityRole="button" accessibilityLabel="Go">
        <Text>Go</Text>
      </PressableScale>,
    );
    await act(async () => {});

    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');
    expect(scale()).toBe(1);
    expect(style().opacity).toBeLessThan(1);
  });
});
