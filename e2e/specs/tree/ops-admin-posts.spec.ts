import { test, expect } from '@playwright/test';
import { openPageAsActor } from './helpers';
import { PostFactory } from '../../factories/PostFactory';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { cleanupPosts } from '../../helpers/cleanup';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Operation Tree - Admin Dashboard/Posts/PostEditor', () => {
  const postsApi = new PostsApiClient();
  const createdPostIds: number[] = [];

  test.afterAll(async () => {
    await cleanupPosts(createdPostIds);
  });

  test('OP-401 OP-402 OP-403 OP-404: admin dashboard entry actions', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      await page.getByTestId('create-post-action').locator('a').click();
      await expect(page).toHaveURL(/\/admin\/posts\/new$/);

      await page.goto('/admin');
      await page.getByTestId('manage-posts-action').locator('a').click();
      await expect(page).toHaveURL(/\/admin\/posts$/);

      await page.goto('/admin');
      await page.getByTestId('manage-projects-action').locator('a').click();
      await expect(page).toHaveURL(/\/admin\/projects$/);
      await page.goto('/admin');
      await page.getByTestId('manage-comments-action').locator('a').click();
      await expect(page).toHaveURL(/\/admin\/comments$/);
      await page.goto('/admin');
      await page.getByTestId('edit-resume-action').locator('a').click();
      await expect(page).toHaveURL(/\/admin\/resume$/);
    } finally {
      await context.close();
    }
  });

  test('OP-501 OP-502 OP-503 OP-504 OP-505: admin posts list actions', async ({ browser }) => {
    const seed = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(seed.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts');
      await expect(page.getByTestId('admin-posts-page')).toBeVisible();

      await page.getByTestId('new-post-btn').click();
      await expect(page).toHaveURL(/\/admin\/posts\/new$/);

      await page.goto('/admin/posts');
      await page.getByTestId(`edit-post-btn-${seed.id}`).click();
      await expect(page).toHaveURL(new RegExp(`/admin/posts/${seed.id}$`));

      await page.goto('/admin/posts');
      const preview = page.getByTestId(`preview-post-btn-${seed.id}`).locator('a');
      await expect(preview).toHaveAttribute('href', new RegExp(`/blog/${seed.slug}$`));

      await page.goto('/admin/posts');
      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-post-btn-${seed.id}`).click();
      await expect(page.getByTestId(`delete-post-btn-${seed.id}`)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('OP-506: admin posts empty-state CTA (conditional)', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts');
      const emptyCta = page.getByRole('link', { name: 'Create your first post' });
      if (await emptyCta.isVisible()) {
        await emptyCta.click();
        await expect(page).toHaveURL(/\/admin\/posts\/new$/);
      }
    } finally {
      await context.close();
    }
  });

  test('OP-601 OP-602 OP-603 OP-604 OP-605 OP-606 OP-608 OP-609: post editor field operations and back', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts/new');
      await page.getByTestId('post-title-input').fill(`Tree Post ${Date.now()}`);
      await expect(page.getByTestId('post-slug-input')).not.toHaveValue('');
      await page.getByTestId('post-content-input').fill('Tree post content');
      await page.getByTestId('post-summary-input').fill('Tree post summary');
      await page.getByTestId('post-status-select').selectOption('draft');

      const firstTag = page.locator('[data-testid^="tag-badge-"]').first();
      if (await firstTag.isVisible()) {
        await firstTag.click();
      }

      const [saveRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/admin/posts') && res.request().method() === 'POST'),
        page.getByTestId('post-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const id = body.post?.id || body.id;
      if (id) {
        createdPostIds.push(id);
      }

      await page.getByRole('link', { name: 'Back to Posts' }).click();
      await expect(page).toHaveURL(/\/admin\/posts$/);
    } finally {
      await context.close();
    }
  });

  test('OP-607: post editor cover image input is present', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/admin/posts/new');
      await expect(page.getByTestId('cover-image-upload')).toBeAttached();
    } finally {
      await context.close();
    }
  });
});
