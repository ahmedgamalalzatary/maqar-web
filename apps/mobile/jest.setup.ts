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
// The photo picker opens a native screen; tests say what it returns.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  UIImagePickerPreferredAssetRepresentationMode: { Automatic: 'automatic', Compatible: 'compatible', Current: 'current' },
}));
// Listing videos play in a native view; tests see which video was opened.
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: (source: { uri: string }, setup?: (p: object) => void) => {
      const player = { source, play: jest.fn(), pause: jest.fn(), release: jest.fn() };
      setup?.(player);
      return player;
    },
    VideoView: ({ player, ...props }: { player: { source: { uri: string } } }) => require('react').createElement(View, { ...props, testID: 'video-view', accessibilityLabel: player.source.uri }),
  };
});
// Photos are resized on the phone before sending; tests get the same file back.
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const ctx = { resize: () => ctx, renderAsync: async () => ({ saveAsync: async () => ({ uri, width: 10, height: 10 }) }) };
      return ctx;
    },
  },
}));
