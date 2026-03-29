import { test, expect } from '@playwright/test';
import { openPageAsActor } from './helpers';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Operation Tree - Public Navigation', () => {
  test('OP-001 OP-003: top nav works and anonymous can open login page', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await page.locator('header').getByRole('link', { name: 'Blog' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await page.locator('header').getByRole('link', { name: 'Portfolio' }).click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      await page.locator('header').getByRole('link', { name: 'Resume' }).click();
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
      await page.locator('header').getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-002: theme toggle button is clickable', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      const toggle = page.getByTestId('theme-toggle-btn').first();
      await expect(toggle).toBeVisible({ timeout: 10_000 });
      await toggle.click();
      await toggle.click();
    } finally {
      await context.close();
    }
  });

  test('OP-004: GitHub login endpoint responds with redirect', async ({ browser }) => {
    const { context } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      const res = await context.request.get('/api/auth/github', { maxRedirects: 0 });
      expect([301, 302, 303, 307, 308]).toContain(res.status());
      const location = res.headers()['location'] || '';
      expect(location.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('OP-005: auth callback restores session and redirects to saved path', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/login');
      await page.evaluate(() => {
        sessionStorage.setItem('redirectAfterLogin', '/admin/posts');
      });
      await page.goto('/auth/callback');
      await expect(page).toHaveURL(/\/admin\/posts$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-006 OP-007 OP-008: avatar menu supports dashboard and logout', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      const avatar = page.locator('header').getByTestId('user-avatar');
      await expect(avatar).toBeVisible({ timeout: 10_000 });
      await avatar.click();
      await expect(page.getByTestId('dashboard-link')).toBeVisible({ timeout: 5_000 });
      await page.getByTestId('dashboard-link').click();
      await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

      await page.goto('/');
      const avatar2 = page.locator('header').getByTestId('user-avatar');
      await expect(avatar2).toBeVisible({ timeout: 10_000 });
      await avatar2.click();
      await page.getByTestId('logout-btn').click();
      await expect(page.locator('header').getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-009 OP-010 OP-011: mobile menu expand-collapse and mobile login button', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await page.goto('/');
      const menuBtn = page.locator('header button.md\\:hidden');
      await expect(menuBtn).toBeVisible({ timeout: 10_000 });
      await menuBtn.click();
      const mobileBlogLink = page.locator('header').getByRole('link', { name: 'Blog' });
      await expect(mobileBlogLink).toBeVisible({ timeout: 10_000 });
      await mobileBlogLink.click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await menuBtn.click();
      await expect(page.locator('header').getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });
      await page.locator('header').getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-051 OP-052 OP-053 OP-054: home page CTA entries navigate correctly', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await page.getByRole('link', { name: 'Read Blog' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await page.goto('/');
      await page.getByRole('link', { name: 'View Portfolio' }).first().click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      await page.goto('/');
      await page.getByRole('link', { name: 'Read Articles' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await page.goto('/');
      await page.getByRole('link', { name: 'View Resume' }).click();
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-061 OP-062: footer quick links and tag links are reachable', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await page.getByRole('link', { name: 'Home' }).last().click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
      await page.getByRole('link', { name: 'Technology' }).click();
      await expect(page).toHaveURL(/\/blog\?tag=technology$/, { timeout: 10_000 });
      await page.goto('/');
      await page.getByRole('link', { name: 'Programming' }).click();
      await expect(page).toHaveURL(/\/blog\?tag=programming$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-063 OP-064: footer social and mail links have expected href', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      const socialLinks = page.locator('footer a[target="_blank"]');
      await expect(socialLinks).toHaveCount(3, { timeout: 10_000 });
      const hrefs = await socialLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
      expect(hrefs.some((h) => h.startsWith('https://github.com'))).toBeTruthy();
      expect(hrefs.some((h) => h.startsWith('https://twitter.com'))).toBeTruthy();
      expect(hrefs.some((h) => h.startsWith('https://linkedin.com'))).toBeTruthy();

      const mail = page.locator('footer a[href^="mailto:"]');
      await expect(mail).toHaveAttribute('href', 'mailto:hello@example.com', { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-1101 OP-1102: not found page supports go home and go back', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/blog');
      await page.goto('/not-exists-path');
      await page.getByRole('link', { name: 'Go Home' }).click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });

      await page.goto('/blog', { timeout: 10_000 });
      await page.goto('/another-not-found-path');
      await page.getByRole('button', { name: 'Go Back' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
