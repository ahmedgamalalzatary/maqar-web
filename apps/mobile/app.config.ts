import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Contract §5: one .env at the repo root for every app. Expo only reads .env from
// its own folder, so load the root file here, before Metro inlines EXPO_PUBLIC_* vars.
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: { ...config.extra, apiUrl: process.env.EXPO_PUBLIC_API_URL },
});
