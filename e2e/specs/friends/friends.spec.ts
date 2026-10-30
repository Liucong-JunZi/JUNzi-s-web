import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'zh');
    localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
  });
  // Keep frontend-only tests independent of the production API.
  await page.route(/\/api\/(?!index\.ts)/, (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: '{}',
  }));
});

test('navigation, configured sites, language and mobile layout', async ({ page }) => {
  await page.goto('/friends');
  await expect(page.getByRole('heading', { name: 'SLIME', exact: true })).toBeVisible();
  await expect(page.locator('a[href="https://onlyslime.online/feed.xml"]')).toBeVisible();
  await expect(page.locator('a[href="https://zhouhaoyang.me/rss.xml"]')).toBeVisible();
  await expect(page.locator('header nav a[href="/friends"]')).toBeVisible();
  await expect(page.locator('footer a[href="/friends"]')).toBeVisible();
  await page.getByTestId('language-toggle-btn').click();
  await expect(page.getByTestId('friend-links-page').getByRole('heading', { level: 1 })).toHaveText('Friends');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('mobile-menu-btn').click();
  await expect(page.getByTestId('mobile-menu').locator('a[href="/friends"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('site avatars, RSS, fallbacks and unsafe URL filtering', async ({ page }) => {
  await page.route('**/src/data/friendLinks.ts', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const fixture = [
      { name: 'Test Friend', url: 'https://friend.example/', description: 'A friend site', avatarUrl: 'https://friend.example/avatar.svg', rssUrl: 'https://friend.example/feed.xml' },
      { name: 'Broken Avatar', url: 'https://broken.example/', description: 'Fallback', avatarUrl: 'https://broken.example/avatar.png', rssUrl: 'javascript:alert(1)' },
      { name: 'Unsafe Site', url: 'javascript:alert(1)', description: 'Must not render' },
    ];
    const declaration = /const friendLinks = \[[\s\S]*?\];/;
    expect(source).toMatch(declaration);
    await route.fulfill({ response, body: source.replace(declaration, `const friendLinks = ${JSON.stringify(fixture)};`) });
  });
  await page.route('https://friend.example/avatar.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
  }));
  await page.route('https://broken.example/avatar.png', (route) => route.fulfill({ status: 404 }));
  await page.goto('/friends');
  await expect(page.getByRole('heading', { name: 'Test Friend' })).toBeVisible();
  const image = page.locator('img[src="https://friend.example/avatar.svg"]');
  await expect(image).toBeVisible();
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBeTruthy();
  const rss = page.locator('a[href="https://friend.example/feed.xml"]');
  await expect(rss).toHaveAttribute('target', '_blank');
  await expect(rss).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByTestId('friend-links-page').locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Unsafe Site' })).toHaveCount(0);
  const brokenCard = page.getByRole('listitem').filter({ hasText: 'Broken Avatar' });
  await expect(brokenCard.getByText('B', { exact: true })).toBeVisible();
  await page.getByTestId('theme-toggle-btn').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(rss).toBeVisible();
});
