import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'zh');
  });
  await page.route(/\/api\/(?!index\.ts)/, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/posts/meta-check') {
      return route.fulfill({ json: { post: {
        id: 42, title: 'Server Meta Check', slug: 'meta-check', content: 'Body',
        summary: 'A short summary.', created_at: '2026-01-02T00:00:00Z',
        tags: [], author: { username: 'Test' }, view_count: 0, like_count: 0,
      } } });
    }
    if (path.startsWith('/api/projects/')) return route.fulfill({ json: {
      id: 7, title: 'Project Meta', description: 'Project summary', content: 'x',
      cover_image: '', demo_url: '', github_url: '', tech_stack: '', status: 'active',
    } });
    if (path === '/api/projects') return route.fulfill({ json: { projects: [], total: 0, page: 1, page_size: 10 } });
    if (path.includes('comments')) return route.fulfill({ json: { comments: [], total: 0 } });
    return route.fulfill({ status: 401, json: {} });
  });
});

test('client navigation keeps title and canonical in sync', async ({ page }) => {
  await page.goto('/blog/meta-check');
  const head = () => page.evaluate(() => ({
    title: document.title,
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    description: document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    ogTitle: document.head.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ogType: document.head.querySelector('meta[property="og:type"]')?.getAttribute('content'),
  }));

  await expect.poll(async () => (await head()).title).toBe('Server Meta Check | JUNzi');
  let state = await head();
  expect(state.canonical).toBe('https://junziliucong.online/blog/meta-check');
  expect(state.description).toBe('A short summary.');
  expect(state.ogTitle).toBe('Server Meta Check | JUNzi');
  expect(state.ogType).toBe('article');

  await page.locator('header a[href="/friends"]').first().click();
  await expect.poll(async () => (await head()).canonical).toBe('https://junziliucong.online/friends');
  state = await head();
  expect(state.title).not.toBe('Server Meta Check | JUNzi');
  expect(state.ogType).toBe('website');
  expect(await page.evaluate(() => document.head.querySelectorAll('title').length)).toBe(1);
  expect(await page.evaluate(() => document.head.querySelectorAll('link[rel="canonical"]').length)).toBe(1);
});
