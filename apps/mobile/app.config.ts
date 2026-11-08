import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Contract §5: one .env at the repo root for every app. Expo only reads .env from
// its own folder, so load the root file here, before Metro inlines EXPO_PUBLIC_* vars.
// (In CI there is no .env; the workflow sets the variables itself.)
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    // Android release builds refuse plain http:// unless allowed. Only needed while
    // the API runs on a LAN address without TLS; production uses https.
    ['expo-build-properties', { android: { usesCleartextTraffic: apiUrl?.startsWith('http://') ?? false } }],
  ],
  extra: { ...config.extra, apiUrl },
});
