import { test, expect } from '@playwright/test';
import { openPageAsActor } from './helpers';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Operation Tree - Auth & Permissions', () => {
  test('OP-003: anonymous user clicking login enters /login', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await page.getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  });

  test('S0 permission path: anonymous user is blocked from /admin and admin API', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login$/);
      const res = await context.request.get('/api/admin/posts');
      expect([401, 403]).toContain(res.status());
    } finally {
      await context.close();
    }
  });

  test('S1 permission path: regular user redirected from /admin and denied admin API', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'user');
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/$/);
      const res = await context.request.get('/api/admin/posts');
      expect(res.status()).toBe(403);
    } finally {
      await context.close();
    }
  });

  test('S2 permission path: admin can access dashboard and admin posts', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard')).toBeVisible();
      await page.goto('/admin/posts');
      await expect(page.getByTestId('admin-posts-page')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('OP-007: logout invalidates current session and /api/auth/me becomes 401', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible();

      const me = await context.request.get('/api/auth/me');
      expect(me.status()).toBe(401);
    } finally {
      await context.close();
    }
  });

  test('refresh path: clear access_token then page can still restore via refresh', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts');
      await expect(page.getByTestId('admin-posts-page')).toBeVisible();

      await context.clearCookies({ name: 'access_token' });
      await page.reload();

      await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });
      const me = await context.request.get('/api/auth/me');
      expect(me.ok()).toBeTruthy();
    } finally {
      await context.close();
    }
  });
});
