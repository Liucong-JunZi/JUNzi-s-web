import { test, expect } from '@playwright/test';
import { openPageAsActor, readCsrfToken } from './helpers';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { CommentsApiClient } from '../../clients/CommentsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

async function createProjectViaAdminApi(
  requestCtx: { post: Function },
  csrf: string,
  payload: Record<string, unknown>
): Promise<number> {
  const res = await requestCtx.post('/api/admin/projects', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    data: JSON.stringify(payload),
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.project?.id || body.id;
}

test.describe('Operation Tree - Public Content', () => {
  const postsApi = new PostsApiClient();
  const commentsApi = new CommentsApiClient();
  const createdPostIds: number[] = [];
  const createdProjectIds: number[] = [];

  test.afterAll(async ({ browser }) => {
    await cleanupPosts(createdPostIds);
    const { context } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      for (const projectId of createdProjectIds) {
        await context.request.delete(`/api/admin/projects/${projectId}`, {
          headers: { 'X-CSRF-Token': csrf },
        });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-101 OP-102 OP-103 OP-104: blog search, clear filter, open post, pagination', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/blog');
      await page.getByTestId('blog-search-input').fill(seed.title.split(' ')[0]);
      await page.getByTestId('blog-search-btn').click();
      await expect(page).toHaveURL(/\/blog/);

      await page.goto('/blog?tag=technology');
      const clearFilter = page.getByTestId('clear-filter-btn');
      if (await clearFilter.isVisible()) {
        await clearFilter.click();
        await expect(page).toHaveURL(/\/blog$/);
      }

      const card = page.getByTestId('post-card').first();
      await expect(card).toBeVisible();
      await card.click();
      await expect(page).toHaveURL(/\/blog\/.+/);
      await expect(page.getByTestId('post-title')).toBeVisible();

      await page.goto('/blog');
      const nextBtn = page.getByTestId('pagination-next');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await expect(page).toHaveURL(/\/blog/);
        await page.getByTestId('pagination-prev').click();
      }
    } finally {
      await context.close();
    }
  });

  test('OP-105 OP-106 OP-107 OP-108 OP-109: blog post like, comment auth paths, load more', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    for (let i = 0; i < 12; i += 1) {
      const created = await commentsApi.createAsUser({ content: `seed-comment-${i}`, post_id: post.id });
      const cid = created.comment?.id || created.id;
      if (cid) {
        await commentsApi.approveAsAdmin(cid);
      }
    }

    const anon = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await anon.page.goto(`/blog/${post.slug}`);
      await expect(anon.page.getByTestId('like-btn')).toBeVisible();
      await anon.page.getByTestId('like-btn').click();
      await expect(anon.page.getByTestId('comments-section')).toBeVisible();
      await expect(anon.page.getByTestId('comment-login-link')).toBeVisible();
      await anon.page.getByTestId('comment-login-link').click();
      await expect(anon.page).toHaveURL(/\/login$/);
    } finally {
      await anon.context.close();
    }

    const user = await openPageAsActor(browser, baseURL, 'user');
    try {
      await user.page.goto(`/blog/${post.slug}`);
      await expect(user.page.getByTestId('comment-textarea')).toBeVisible();
      await user.page.getByTestId('comment-textarea').fill(`public-content-comment-${Date.now()}`);
      const [commentRes] = await Promise.all([
        user.page.waitForResponse((res) => res.url().includes('/api/comments') && res.request().method() === 'POST'),
        user.page.getByTestId('comment-submit-btn').click(),
      ]);
      expect(commentRes.status()).toBe(201);

      const loadMore = user.page.getByTestId('load-more-comments-btn');
      if (await loadMore.isVisible()) {
        await loadMore.click();
      }
    } finally {
      await user.context.close();
    }
  });

  test('OP-201 OP-202 OP-203 OP-204: portfolio list, detail, code/demo/back operations', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const projectId = await createProjectViaAdminApi(context.request as any, csrf, {
        title: `E2E Project ${Date.now()}`,
        description: 'seed project for operation tree',
        tech_stack: 'React,TypeScript',
        status: 'active',
        sort_order: 1,
        demo_url: 'https://example.com/demo',
        github_url: 'https://github.com/example/repo',
      });
      createdProjectIds.push(projectId);

      await page.goto('/portfolio');
      const details = page.getByTestId('project-details-btn').first();
      await expect(details).toBeVisible();
      await details.click();
      await expect(page).toHaveURL(/\/portfolio\/\d+$/);

      const codeBtn = page.getByTestId('project-code-btn');
      const demoBtn = page.getByTestId('project-demo-btn');
      await expect(codeBtn.locator('a')).toHaveAttribute('href', /github\.com/);
      await expect(demoBtn.locator('a')).toHaveAttribute('href', /example\.com\/demo/);

      await page.getByTestId('back-to-portfolio-btn').click();
      await expect(page).toHaveURL(/\/portfolio$/);
    } finally {
      await context.close();
    }
  });

  test('OP-301: resume download button is actionable', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createResume = await context.request.post('/api/admin/resume', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          title: `ResumeSeed-${Date.now()}`,
          company: 'E2E Co',
          location: 'Shanghai',
          start_date: '2024-01-01',
          type: 'work',
          sort_order: 1,
        }),
      });
      expect(createResume.ok()).toBeTruthy();

      await page.goto('/resume');
      const btn = page.getByTestId('resume-download-btn');
      await expect(btn).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await btn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('resume');
    } finally {
      await context.close();
    }
  });
});
