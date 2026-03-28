import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('TC-001: admin login sets valid session @p0', async ({ request }) => {
    const res = await request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.role).toBe('admin');
    expect(body.csrf_token).toBeDefined();

    const me = await request.get('/api/auth/me');
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).user.role).toBe('admin');
  });

  test('TC-003: logout clears all cookies @p0', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('user-avatar')).toBeVisible();
    await page.getByTestId('user-avatar').click();
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });

    const cookies = await context.cookies();
    expect(cookies.filter(c => ['access_token','refresh_token','csrf_token'].includes(c.name))).toHaveLength(0);
  });

  test('TC-002: token refresh after access token cleared @p1', async ({ page, context }) => {
    await page.goto('/admin/posts');
    await expect(page.getByTestId('admin-posts-page')).toBeVisible();
    await context.clearCookies({ name: 'access_token' });
    await page.reload();
    await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });
  });

  test('TC-010: CSRF enforcement @p2', async ({ request }) => {
    const res = await request.post('/api/comments', { data: { content: 'no csrf', post_id: 1 } });
    expect(res.status()).toBe(403);
  });
});
