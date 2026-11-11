import { render, screen } from '@testing-library/react-native';
import { ExecutionEnvironment } from 'expo-constants';
import { canShowMap, LocationMap } from '@/features/property/components/location-map';

// jest cannot fake Platform.OS for the component (it resolves another instance), so the four
// build cases are asserted on the pure gate, and the render test only checks the wiring.
describe('when a map can be shown', () => {
  it('not on Android with no key, so the page still opens', () => {
    expect(canShowMap('android', ExecutionEnvironment.Standalone, false)).toBe(false);
  });

  it('on Android when the build has a key', () => {
    expect(canShowMap('android', ExecutionEnvironment.Standalone, true)).toBe(true);
  });

  it('in Expo Go, which brings its own key', () => {
    expect(canShowMap('android', ExecutionEnvironment.StoreClient, false)).toBe(true);
  });

  it('on iOS, where Apple Maps needs no key', () => {
    expect(canShowMap('ios', ExecutionEnvironment.Standalone, false)).toBe(true);
  });
});

describe('LocationMap rendering', () => {
  it('shows the map with the pin', async () => {
    await render(<LocationMap lat={30} lng={31} title="Home" />);
    expect(screen.getByTestId('map')).toBeOnTheScreen();
  });
});
