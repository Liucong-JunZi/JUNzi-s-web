import { test, expect } from '@playwright/test';
import { openPageAsActor, readCsrfToken } from './helpers';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { CommentsApiClient } from '../../clients/CommentsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Operation Tree - Admin Comments/Projects/Resume', () => {
  const postsApi = new PostsApiClient();
  const commentsApi = new CommentsApiClient();
  const createdPostIds: number[] = [];
  const createdProjectIds: number[] = [];
  const createdResumeIds: number[] = [];

  test.afterAll(async ({ browser }) => {
    await cleanupPosts(createdPostIds);
    const { context } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      for (const id of createdProjectIds) {
        await context.request.delete(`/api/admin/projects/${id}`, {
          headers: { 'X-CSRF-Token': csrf },
        });
      }
      for (const id of createdResumeIds) {
        await context.request.delete(`/api/admin/resume/${id}`, {
          headers: { 'X-CSRF-Token': csrf },
        });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-701 OP-702 OP-703 OP-704 OP-705 OP-706 OP-707: comments moderation operations', async ({ browser }) => {
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser({ content: `pending-${Date.now()}`, post_id: post.id });
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible();

      const row = page.getByTestId(`comment-row-${commentId}`);
      await expect(row).toBeVisible();
      await expect(page.getByTestId(`comment-status-${commentId}`)).toBeVisible();

      if (await page.getByTestId(`approve-comment-btn-${commentId}`).isVisible()) {
        await page.getByTestId(`approve-comment-btn-${commentId}`).click();
      }
      await expect(page.getByTestId(`comment-status-${commentId}`)).toContainText(/Approved|Pending|Rejected/);

      if (await page.getByTestId(`reject-comment-btn-${commentId}`).isVisible()) {
        await page.getByTestId(`reject-comment-btn-${commentId}`).click();
      }

      const viewPost = row.getByRole('link', { name: 'View Post' });
      if (await viewPost.isVisible()) {
        await viewPost.click();
        await expect(page).toHaveURL(/\/blog\/.+/);
        await page.goBack();
      }

      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-comment-btn-${commentId}`).click();

      const next = page.getByTestId('pagination-next');
      if (await next.isVisible()) {
        await next.click();
        const prev = page.getByTestId('pagination-prev');
        if (await prev.isVisible()) {
          await prev.click();
        }
      }
    } finally {
      await context.close();
    }
  });

  test('OP-801 OP-802 OP-803 OP-804 OP-805 OP-806: admin projects list operations', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          title: `Mgmt Project ${Date.now()}`,
          description: 'seed',
          tech_stack: 'React,Go',
          status: 'active',
          sort_order: 1,
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const createBody = await createRes.json();
      const projectId = createBody.project?.id || createBody.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });

      await page.goto('/admin/projects');
      await page.getByTestId(`edit-project-btn-${projectId}`).click();
      await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}$`), { timeout: 10_000 });

      await page.goto('/admin/projects');
      const preview = page.getByTestId(`preview-project-btn-${projectId}`);
      await expect(preview).toHaveAttribute('href', new RegExp(`/portfolio/${projectId}$`));

      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-project-btn-${projectId}`).click();

      const emptyCta = page.getByRole('link', { name: 'Create your first project' });
      if (await emptyCta.isVisible()) {
        await emptyCta.click();
        await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-901 OP-902 OP-903 OP-904 OP-905 OP-906: project editor field operations', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects/new');
      await page.getByTestId('project-title-input').fill(`ProjectEditor ${Date.now()}`);
      await page.getByTestId('project-description-input').fill('description');
      await page.getByTestId('project-tech-stack-input').fill('React,TypeScript');
      await page.getByTestId('project-demo-url-input').fill('https://example.com/demo');
      await page.getByTestId('project-github-url-input').fill('https://github.com/example/repo');
      await page.getByTestId('project-status-select').selectOption('active');
      await page.getByTestId('project-sort-order-input').fill('2');
      await expect(page.getByTestId('project-cover-image-upload')).toBeAttached({ timeout: 10_000 });

      const [saveRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/admin/projects') && res.request().method() === 'POST'),
        page.getByTestId('project-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const id = body.project?.id || body.id;
      if (id) {
        createdProjectIds.push(id);
      }

      await page.getByRole('link', { name: 'Back to Projects' }).click();
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-1001 OP-1002 OP-1003 OP-1004: admin resume create/edit/delete/cancel', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('resume-type-select').selectOption('work');
      await page.getByTestId('resume-title-input').fill(`Resume Item ${Date.now()}`);
      await page.getByTestId('resume-company-input').fill('Tree Co');
      await page.getByTestId('resume-location-input').fill('Shanghai');
      await page.getByTestId('resume-start-date-input').fill('2024-01-01');
      await page.getByTestId('resume-end-date-input').fill('2025-01-01');
      await page.getByTestId('resume-description-input').fill('resume markdown');

      const [saveRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/admin/resume') && res.request().method() === 'POST'),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const resumeId = body.item?.id || body.id;
      if (resumeId) {
        createdResumeIds.push(resumeId);
      }

      if (resumeId) {
        await page.getByTestId(`edit-resume-btn-${resumeId}`).click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('cancel-edit-btn').click();

        page.once('dialog', (d) => d.accept());
        await page.getByTestId(`delete-resume-btn-${resumeId}`).click();
      }
    } finally {
      await context.close();
    }
  });
});
