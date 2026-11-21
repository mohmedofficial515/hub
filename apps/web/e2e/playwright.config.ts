/**
 * @file Playwright: the acceptance flows of docs/11 §1.5 and the live-update test of docs/15 §7, in `ar` and `en`.
 * @description One worker, because every test shares one real stack and the timings must not fight each other. `pnpm test:e2e:web`
 * starts that stack on throwaway containers (`support/stack.ts`). It never touches the local Hub database.
 */
import { defineConfig } from '@playwright/test';

import { WEB_URL } from './support/ports';

export default defineConfig({
  testDir: './specs',
  outputDir: process.env['E2E_RESULTS'] ? `${process.env['E2E_RESULTS']}/e2e` : '../test-results/e2e',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  workers: 1,
  // A loaded machine can miss the 1 s once. The report names a retried test as flaky, so it is not hidden.
  retries: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: {
    baseURL: WEB_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'ar', metadata: { hubLocale: 'ar' } },
    { name: 'en', metadata: { hubLocale: 'en' } },
  ],
});
