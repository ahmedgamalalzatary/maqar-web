import { render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { LocationMap } from '@/features/property/components/location-map';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} }, executionEnvironment: 'standalone' },
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone' },
}));

const setUp = (os: 'android' | 'ios', hasKey: boolean, environment = 'standalone') => {
  jest.replaceProperty(Platform, 'OS', os);
  (Constants.expoConfig as { extra: object }).extra = { hasGoogleMapsKey: hasKey };
  (Constants as { executionEnvironment: string }).executionEnvironment = environment;
};

afterEach(() => jest.restoreAllMocks());

// On Android, Google Maps with no key does not show an empty map: it closes the app.
describe('LocationMap', () => {
  const show = () => render(<LocationMap lat={30} lng={31} title="Home" />);

  it('leaves the map out of an Android build with no key, so the page still opens', async () => {
    setUp('android', false);
    await show();
    expect(screen.queryByTestId('map')).toBeNull();
  });

  it('shows the map on Android when the build has a key', async () => {
    setUp('android', true);
    await show();
    expect(screen.getByTestId('map')).toBeOnTheScreen();
  });

  it('shows the map in Expo Go, which brings its own key', async () => {
    setUp('android', false, 'storeClient');
    await show();
    expect(screen.getByTestId('map')).toBeOnTheScreen();
  });

  it('shows the map on iOS, where Apple Maps needs no key', async () => {
    setUp('ios', false);
    await show();
    expect(screen.getByTestId('map')).toBeOnTheScreen();
  });
});
