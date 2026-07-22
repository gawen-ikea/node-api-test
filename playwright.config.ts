import 'dotenv/config';

import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './test/smoke',
  outputDir: 'test-results',
  globalSetup: './test/smoke/global-setup.ts',
  globalTeardown: './test/smoke/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [[process.env.CI ? 'github' : 'list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/vnd.api+json',
    },
  },
  webServer: {
    command: 'pnpm dev',
    url: `${baseURL}/api/auth/providers`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'api',
      testMatch: 'test/smoke/**/*.smoke.spec.ts',
    },
  ],
});
