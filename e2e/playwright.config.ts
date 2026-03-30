import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : '50%',
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports', open: 'never' }],
    ['json', { outputFile: './reports/results.json' }],
    ...(process.env.CI ? [['github']] : []),
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: './reports/artifacts',
  globalSetup: './setup/auth-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'admin-chromium',
      use: { ...devices['Desktop Chrome'], storageState: './storage/admin.storageState.json' },
    },
  ],
});
