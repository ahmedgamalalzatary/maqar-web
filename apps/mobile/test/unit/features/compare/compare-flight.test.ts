import { FLIGHT_MS, flightFor, useCompareFlight } from '@/features/compare/store/compare-flight';

// 2026-11-16: a home picked to compare flies from its scale button into the bar.
describe('The compare flight', () => {
  beforeEach(() => useCompareFlight.setState({ origin: null }));

  it('starts where the button was tapped, for that home only', () => {
    useCompareFlight.getState().launch(4, { x: 300, y: 500 }, 1000);
    expect(flightFor(4, 1100)).toEqual({ x: 300, y: 500 });
    expect(flightFor(5, 1100)).toBeNull();
  });

  it('is gone once it is old, so a bar shown later does not replay it', () => {
    useCompareFlight.getState().launch(4, { x: 300, y: 500 }, 1000);
    expect(flightFor(4, 1000 + FLIGHT_MS + 1)).toBeNull();
  });

  it('flies once', () => {
    useCompareFlight.getState().launch(4, { x: 1, y: 2 }, 1000);
    expect(flightFor(4, 1001)).not.toBeNull();
    expect(flightFor(4, 1002)).toBeNull();
  });
});
