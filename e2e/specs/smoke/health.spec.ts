import { test, expect } from '@playwright/test';

test.describe('Health check', () => {
  test('frontend loads and API responds @p0', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });
});
