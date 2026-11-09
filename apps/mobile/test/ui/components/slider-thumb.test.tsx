import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { RangeSlider } from '@/features/listings/components/range-slider';
import { BudgetSlider } from '@/features/prefs/components/budget-slider';

const scale = { min: 0, max: 100, step: 10 };

const SLIDERS = [
  ['range', () => <RangeSlider scale={scale} value={[0, 100]} onChange={() => {}} minLabel="thumb" maxLabel="other" valueText={String} />],
  ['one-thumb', () => <BudgetSlider scale={scale} value={50} onChange={() => {}} label="thumb" valueText="50" />],
] as const;

const thumb = () => screen.getByRole('adjustable', { name: 'thumb' });

afterEach(() => jest.restoreAllMocks());

// A gesture belongs to a thumb only if it started there. A list scrolling past must not hand it one.
describe.each(SLIDERS)('The thumb of the %s slider', (_name, slider) => {
  it('takes a touch that starts on it, and not one that merely moves over it', async () => {
    await render(slider());
    expect(thumb().props.onStartShouldSetResponder()).toBe(true);
    expect(thumb().props.onMoveShouldSetResponder).toBeUndefined();
  });

  it('on a phone, keeps the drag once it has it, so the page does not scroll instead', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(slider());
    expect(thumb().props.onResponderTerminationRequest()).toBe(false);
  });

  it('on the web, stops the browser panning from it, and never refuses the page a scroll', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await render(slider());
    expect(StyleSheet.flatten(thumb().props.style).touchAction).toBe('none');
    expect(thumb().props.onResponderTerminationRequest()).toBe(true);
  });
});
