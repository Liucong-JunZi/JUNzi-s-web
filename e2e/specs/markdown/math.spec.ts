import { expect, test } from '@playwright/test';

const content = String.raw`Inline: $k &lt; n$ and $c &gt; 0$.

$$
|C_c| \sim \text{Binomial}(n,p_c), \quad \mathbb{E}[|C_c|]=ck
$$

$$
(c-1)k \gtrsim z_{1-\alpha}\sqrt{ck} + n|\delta_q| + n\varepsilon_{fit} + n|\delta_q| + n\varepsilon_{fit}
$$

$$p_c = c\frac{k}{n}$$

Code stays literal: \`$k &lt; n$\`.

<script>window.__markdownXss = true</script>

[unsafe](javascript:alert(1))

$\href{javascript:alert(1)}{unsafe}$
`.replaceAll('\\`', '`');

for (const theme of ['light', 'dark']) {
  test(`math, safety and mobile overflow (${theme})`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem('theme-storage', JSON.stringify({ state: { theme }, version: 0 }));
    }, theme);
    await page.route(/\/api\/(?!index\.ts)/, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/posts/math-check') {
        return route.fulfill({ json: { post: {
          id: 99, title: 'Math check', slug: 'math-check', content,
          created_at: '2026-01-01T00:00:00Z', tags: [], author: { username: 'Test' },
          view_count: 0, like_count: 0,
        } } });
      }
      if (path.includes('comments')) return route.fulfill({ json: { comments: [], total: 0 } });
      return route.fulfill({ status: 401, json: {} });
    });
    await page.goto('/blog/math-check');
    await expect(page.locator('.katex-display')).toHaveCount(3);
    await expect(page.locator('.katex-error')).toHaveCount(0);
    await expect(page.locator('.katex-mathml math')).toHaveCount(6);
    await expect(page.locator('.prose code')).toHaveText('$k &lt; n$');
    await expect(page.locator('.katex').first()).not.toContainText('&lt;');
    expect(await page.evaluate(() => '__markdownXss' in window)).toBe(false);
    await expect(page.locator('.prose a[href^="javascript:"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px KaTeX_Main'))).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.katex-display').nth(1).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
}
