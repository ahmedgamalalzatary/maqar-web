import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Unit tests: business rules and services, no database. Env comes from the root .env.test.
const env = config({ path: '../../.env.test', quiet: true }).parsed ?? {};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/unit/**/*.spec.ts'],
    env,
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/main.ts'] },
  },
});
