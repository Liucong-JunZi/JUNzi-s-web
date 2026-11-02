import { expect, test } from '@playwright/test';

// Runs against the deployed origin; set SSR_BASE_URL to point it elsewhere.
const base = process.env.SSR_BASE_URL || 'https://junziliucong.online';

const pages = ['/', '/blog', '/blog/my-memories', '/portfolio', '/portfolio/2', '/resume', '/friends'];

for (const path of pages) {
  test(`server-rendered markup and clean hydration (${path})`, async ({ browser }) => {
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const crawl = await noJs.newPage();
    await crawl.goto(base + path, { waitUntil: 'domcontentloaded' });
    const rendered = await crawl.evaluate(() => ({
      chars: document.querySelector('#root')?.textContent?.length ?? 0,
      title: document.title,
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      data: Boolean(document.getElementById('__SSR_DATA__')),
    }));
    await noJs.close();
    expect(rendered.data).toBe(true);
    expect(rendered.chars).toBeGreaterThan(150);
    expect(rendered.title.length).toBeGreaterThan(3);
    expect(rendered.canonical).toContain('junziliucong.online');

    const page = await browser.newPage();
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/401|Unauthorized/.test(m.text())) problems.push(m.text());
    });
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(problems).toEqual([]);
    expect(await page.evaluate(() => (document.querySelector('#root')?.children.length ?? 0) > 0)).toBe(true);
    await page.close();
  });
}

test('hydrated app stays interactive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.getByTestId('theme-toggle-btn').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).not.toBe(before);
});

test('unknown slugs return 404 with noindex', async ({ request }) => {
  const res = await request.get(`${base}/blog/does-not-exist`);
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain('name="robots" content="noindex"');
});
