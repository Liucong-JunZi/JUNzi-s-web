import { defineConfig, devices } from '@playwright/test';

// Verifies the deployed SSR service; no local web server is started.
export default defineConfig({
  testDir: './specs/ssr',
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] },
});
