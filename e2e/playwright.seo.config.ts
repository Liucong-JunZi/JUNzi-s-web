import { defineConfig } from '@playwright/test';
import frontendConfig from './playwright.friends.config';

export default defineConfig({
  ...frontendConfig,
  testDir: './specs/seo',
});
