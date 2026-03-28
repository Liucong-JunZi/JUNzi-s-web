import { test, expect } from '@playwright/test';

test.describe('Permission enforcement', () => {
  test('TC-007: regular user blocked from admin @p0', async ({ page, request }) => {
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin$/);

    const res = await request.get('/api/admin/posts');
    expect(res.status()).toBe(403);
  });
});
