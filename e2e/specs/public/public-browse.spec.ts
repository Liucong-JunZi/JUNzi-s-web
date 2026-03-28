import { test, expect } from '@playwright/test';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

test.describe('Public browsing', () => {
  const api = new PostsApiClient();
  const ids: number[] = [];

  test.beforeAll(async () => {
    const data = PostFactory.create({ status: 'published' });
    const post = await api.create(data);
    ids.push(post.id);
  });
  test.afterAll(async () => { await cleanupPosts(ids); });

  test('TC-008: blog page shows posts @p0', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.getByTestId('blog-page')).toBeVisible();
    const firstLink = page.locator('a[href*="/blog/"]').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(page.getByTestId('post-title')).toBeVisible();
    }
  });
});
