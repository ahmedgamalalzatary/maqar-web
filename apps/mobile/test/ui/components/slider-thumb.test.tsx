import { render, screen } from '@testing-library/react-native';
import { RangeSlider } from '@/features/listings/components/range-slider';
import { BudgetSlider } from '@/features/prefs/components/budget-slider';
import { thumbResponder, thumbStyle } from '@/components/slider-thumb';

const scale = { min: 0, max: 100, step: 10 };

const SLIDERS = [
  ['range', () => <RangeSlider scale={scale} value={[0, 100]} onChange={() => {}} minLabel="thumb" maxLabel="other" valueText={String} />],
  ['one-thumb', () => <BudgetSlider scale={scale} value={50} onChange={() => {}} label="thumb" valueText="50" />],
] as const;

const thumb = () => screen.getByRole('adjustable', { name: 'thumb' });

// jest cannot fake Platform.OS for the components (they resolve another instance), so the web and
// phone behaviors are asserted on the helpers with an explicit platform, and the render tests
// below only check that a thumb carries the responder wiring.
describe.each(SLIDERS)('The thumb of the %s slider', (_name, slider) => {
  it('takes a touch that starts on it, and not one that merely moves over it', async () => {
    await render(slider());
    expect(thumb().props.onStartShouldSetResponder()).toBe(true);
    expect(thumb().props.onMoveShouldSetResponder).toBeUndefined();
  });

  it('keeps the drag once it has it, so the page does not scroll instead', () => {
    expect(thumbResponder('android').onResponderTerminationRequest()).toBe(false);
    expect(thumbResponder('web').onResponderTerminationRequest()).toBe(true);
  });

  it('stops the browser panning from it on the web only', () => {
    expect(thumbStyle('web')).toMatchObject({ touchAction: 'none' });
    expect(thumbStyle('android')).toEqual({});
  });
});
