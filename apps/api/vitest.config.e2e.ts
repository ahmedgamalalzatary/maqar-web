import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// e2e tests: the real Nest app over HTTP (supertest). Env, including the
// maqar_test database, comes from the root .env.test.
const env = config({ path: '../../.env.test', quiet: true }).parsed ?? {};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    env,
    // Tests share one database, so run the files one after another.
    fileParallelism: false,
  },
});
