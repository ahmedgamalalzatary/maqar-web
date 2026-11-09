// Runs before every test file.
// AsyncStorage has no native module under Jest, so use its official mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-secure-store has no native module under Jest: keep values in memory.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

// react-native-maps is a native view: render plain Views under Jest.
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = (props: object) => require('react').createElement(View, { ...props, testID: 'map' });
  const Marker = (props: object) => require('react').createElement(View, props);
  return { __esModule: true, default: MapView, Marker, PROVIDER_GOOGLE: 'google' };
});

// Phone notifications have no native module under Jest: see test/utils/notifications.ts.
jest.mock('expo-notifications', () => require('./test/utils/notifications').notificationsMock);
jest.mock('expo-device', () => ({ isDevice: true }));
