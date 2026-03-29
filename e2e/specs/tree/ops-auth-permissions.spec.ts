import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

async function openPageAsActor(
  browser: Browser,
  url: string,
  role: 'anonymous' | 'user' | 'admin',
): Promise<{ context: BrowserContext; page: Page }> {
  const storageState =
    role === 'anonymous'
      ? undefined
      : role === 'admin'
        ? './storage/admin.storageState.json'
        : './storage/user.storageState.json';

  const context = storageState
    ? await browser.newContext({ storageState })
    : await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

test.describe('Auth & Permission checks', () => {
  test('OP-003: anonymous user clicking login enters /login', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('header').getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
      await page.locator('header').getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login$/);
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
      await expect(page.locator('header').getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
      await page.locator('header').getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.locator('header').getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
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
