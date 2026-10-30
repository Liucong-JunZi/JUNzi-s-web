import { defineConfig, devices } from '@playwright/test';

// Standalone frontend checks: no OAuth credentials or database required.
export default defineConfig({
  testDir: './specs/friends',
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5178' },
  webServer: {
    command: 'pnpm --dir ../frontend dev --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
  },
});
