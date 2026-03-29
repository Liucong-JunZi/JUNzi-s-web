import { test, expect } from '@playwright/test';
import { openPageAsActor } from './helpers';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Auth & Permission checks', () => {
  test('OP-003: anonymous user clicking login enters /login', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('S0: anonymous user visiting /admin is redirected to /login', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('S1: regular user visiting /admin is redirected to /', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'user');
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-006: admin can visit /admin', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-007: logout clears session and shows login button', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('refresh path: token refresh after access token cleared', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts');
      await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });
      await context.clearCookies({ name: 'access_token' });
      await page.reload();
      await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});
