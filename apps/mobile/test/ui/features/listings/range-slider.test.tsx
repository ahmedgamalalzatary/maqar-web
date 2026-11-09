import type { Lang, Scale } from '@maqar/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { RangeSlider } from '@/features/listings/components/range-slider';
import { renderWithProviders } from '../../../utils/render';

// 0–100 in steps of 10 over a 228 px slider: the 28 px thumb leaves 200 px of track, 20 px a step.
const scale: Scale = { min: 0, max: 100, step: 10 };

function Slider() {
  const [value, setValue] = useState<[number, number]>([0, 100]);
  return (
    <RangeSlider testID="slider" scale={scale} value={value} onChange={setValue} minLabel="min" maxLabel="max" valueText={String} />
  );
}

async function render(lang: Lang) {
  await renderWithProviders(<Slider />, { lang });
  await act(() => fireEvent(screen.getByTestId('slider'), 'layout', { nativeEvent: { layout: { width: 228, height: 84 } } }));
}

async function drag(name: 'min' | 'max', from: number, to: number) {
  const thumb = screen.getByRole('adjustable', { name });
  await act(() => fireEvent(thumb, 'responderGrant', { nativeEvent: { pageX: from } }));
  await act(() => fireEvent(thumb, 'responderMove', { nativeEvent: { pageX: to } }));
}

const now = (name: 'min' | 'max') => screen.getByRole('adjustable', { name }).props.accessibilityValue.now;

describe('RangeSlider', () => {
  it('follows the finger in steps, left to right in English', async () => {
    await render('en');
    await drag('min', 0, 65); // 3.25 steps → 3
    expect(now('min')).toBe(30);
    await drag('max', 200, 120); // 4 steps back
    expect(now('max')).toBe(60);
  });

  it('is mirrored in Arabic: the minimum starts on the right and moves left', async () => {
    await render('ar');
    await drag('min', 200, 140);
    expect(now('min')).toBe(30);
    await drag('min', 140, 300); // past its end
    expect(now('min')).toBe(0);
  });

  it('never lets the thumbs pass each other', async () => {
    await render('en');
    await drag('min', 0, 400);
    expect(now('min')).toBe(90);
    expect(now('max')).toBe(100);
  });
});
