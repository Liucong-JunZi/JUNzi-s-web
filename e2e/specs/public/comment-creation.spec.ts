import { test, expect } from '@playwright/test';
import { BlogPostPage } from '../../pages/public/BlogPostPage';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

test.describe('Comment creation', () => {
  const api = new PostsApiClient();
  let post: any;
  const ids: number[] = [];

  test.beforeAll(async () => {
    const data = PostFactory.create({ status: 'published' });
    post = await api.create(data);
    ids.push(post.id);
  });
  test.afterAll(async () => { await cleanupPosts(ids); });

  test('TC-009: authenticated user creates comment @p1', async ({ page }) => {
    const bp = new BlogPostPage(page);
    await bp.goto(post.slug);
    await expect(bp.page.getByTestId('comment-textarea')).toBeVisible();
    const text = `E2E comment ${Date.now()}`;
    await bp.submitComment(text);
    const res = await page.waitForResponse('**/api/comments');
    expect(res.status()).toBe(201);
  });
});
