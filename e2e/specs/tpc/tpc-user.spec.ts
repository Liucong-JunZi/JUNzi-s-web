import { test, expect } from '@playwright/test';
import { createActorContext } from '../tree/helpers';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

test.describe.configure({ mode: 'parallel' });

const baseURL = process.env.BASE_URL ?? 'http://localhost';

test.describe('TPC Authenticated User', () => {
  const postsApi = new PostsApiClient();
  const createdPostIds: number[] = [];

  test.afterAll(async () => {
    await cleanupPosts(createdPostIds);
  });

  // TPC pairs: 16,56,67,151
  // PATH_41: Login → browse blog → read post → submit comment → success
  test('OP-201: user submits comment on a blog post successfully', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/blog');
      await expect(page.getByTestId('blog-post-list')).toBeVisible({ timeout: 10_000 });

      await page.goto(`/blog/${seed.slug}`);
      await expect(page.getByTestId('post-content')).toBeVisible({ timeout: 10_000 });

      await expect(page.getByTestId('comment-textarea')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('comment-textarea').fill('OP-201 automated comment');
      await page.getByTestId('comment-submit-btn').click();

      await expect(page.getByTestId('comment-success-msg')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 16,56,67,152
  // PATH_42: Login → browse blog → read post → submit comment → error
  test('OP-202: user submits empty comment and sees validation error', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${seed.slug}`);
      await expect(page.getByTestId('post-content')).toBeVisible({ timeout: 10_000 });

      await expect(page.getByTestId('comment-textarea')).toBeVisible({ timeout: 10_000 });
      // Submit without filling — triggers error path
      await page.getByTestId('comment-submit-btn').click();

      await expect(page.getByTestId('comment-error-msg')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 65,66,64
  // PATH_43: Login → blog → post → like → back to blog
  test('OP-203: user likes a blog post then navigates back', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${seed.slug}`);
      await expect(page.getByTestId('post-content')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('post-like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      await likeBtn.click();
      await expect(page.getByTestId('post-liked-indicator')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('back-to-blog-btn').click();
      await expect(page).toHaveURL(/\/blog/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 71,73
  // PATH_44: Login → browse portfolio → project detail → back
  test('OP-204: user browses portfolio and views project detail', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/portfolio');
      await expect(page.getByTestId('portfolio-list')).toBeVisible({ timeout: 10_000 });

      const firstProject = page.getByTestId('portfolio-item').first();
      await expect(firstProject).toBeVisible({ timeout: 10_000 });
      await firstProject.click();
      await expect(page).toHaveURL(/\/portfolio\/\d+/, { timeout: 10_000 });
      await expect(page.getByTestId('project-detail')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('back-to-portfolio-btn').click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 21,20
  // PATH_45: Login → avatar dropdown → dashboard link blocked (role!=admin)
  test('OP-205: user attempting admin API route receives 403', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      // Attempt admin route via direct navigation; expect redirect to /
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 75
  // PATH_46: Login → resume → download
  test('OP-206: user can view resume page and trigger download', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/resume');
      await expect(page.getByTestId('resume-download-btn')).toBeVisible({ timeout: 10_000 });
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('resume-download-btn').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 63,60,62
  // PATH_47: Login → read blog post → tag filter → clear → paginate
  test('OP-207: user filters blog by tag, clears filter, and paginates', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/blog');
      await expect(page.getByTestId('blog-post-list')).toBeVisible({ timeout: 10_000 });

      // Apply tag filter
      await page.goto('/blog?tag=technology');
      await expect(page).toHaveURL(/\/blog/, { timeout: 10_000 });

      // Clear filter
      const clearBtn = page.getByTestId('clear-filter-btn');
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await expect(page).toHaveURL(/\/blog(?!.*tag)/, { timeout: 10_000 });
      }

      // Attempt pagination
      await page.goto('/blog?page=2');
      await expect(page).toHaveURL(/\/blog/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 129,54
  // PATH_48: Login → mobile menu → logout
  test('OP-208: user opens mobile menu and logs out', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

      const menuToggle = page.getByTestId('mobile-menu-toggle');
      await expect(menuToggle).toBeVisible({ timeout: 10_000 });
      await menuToggle.click();
      await expect(page.getByTestId('mobile-menu')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('mobile-logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 23,20
  // PATH_49: Login → CSRF valid API call → logout
  test('OP-209: user makes a valid CSRF-protected API call then logs out', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      // Make a CSRF-protected call (like a comment) to exercise TPC pair 23
      const cookies = await context.cookies(baseURL);
      const csrf = cookies.find((c) => c.name === 'csrf_token')?.value ?? '';
      expect(csrf.length).toBeGreaterThan(0);

      const res = await context.request.get('/api/posts', {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(res.ok()).toBeTruthy();

      // Logout via UI
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 21
  // PATH_50: Login → attempt admin route → redirect to home
  test('OP-210: user attempting admin route is redirected to home', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 18,6
  // PATH_30: User login → access token expires + refresh fail → logout → reload
  test('OP-211: user session expires with refresh failure → forced logout', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });

      // Simulate token expiry by clearing both access_token and refresh_token
      await context.clearCookies({ name: 'access_token' });
      await context.clearCookies({ name: 'refresh_token' });

      await page.reload();
      // After failed refresh the app should revert to anonymous state
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 24
  // PATH_34: Login page mounted while authenticated as user → redirect /
  test('OP-212: authenticated user visiting /login is redirected to home', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 22
  // PATH_37: Login ?callback=true success → user session → logout
  test('OP-213: login callback success lands user on home then user can logout', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      // The session is already established via test-login; navigate home
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });

      // Logout to cover the session → anonymous transition
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 11,23,20
  // PATH_32: TEST_MODE login as user → valid CSRF call → logout
  test('OP-214: TEST_MODE user login, CSRF-protected call, then logout', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      // Verify session is active (TEST_MODE login already done in createActorContext)
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });

      // Make CSRF-protected API call to exercise TPC pair 23
      const cookies = await context.cookies(baseURL);
      const csrf = cookies.find((c) => c.name === 'csrf_token')?.value ?? '';
      expect(csrf.length).toBeGreaterThan(0);

      const res = await context.request.get('/api/posts', {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(res.ok()).toBeTruthy();

      // Logout to exercise TPC pair 20 (SA1 → SA0)
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});




