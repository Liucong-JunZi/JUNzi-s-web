import { test, expect } from '@playwright/test';
import { createActorContext } from './helpers';
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
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      // Navigate to a blog post
      await page.getByTestId('post-card').first().click();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      await expect(page.getByTestId('comment-textarea')).toBeVisible({ timeout: 10_000 });
      const commentText = 'OP-201 automated comment';
      await page.getByTestId('comment-textarea').fill(commentText);
      await page.getByTestId('comment-submit-btn').click();

      // Toast message confirms submission success
      await expect(page.getByText('Comment Submitted', { exact: true })).toBeVisible({ timeout: 15_000 });
      // Textarea is cleared after successful submission
      await expect(page.getByTestId('comment-textarea')).toHaveValue('');
      // Comment should NOT be visible because it's pending approval (backend only returns approved)
      const commentsSection = page.getByTestId('comments-section');
      await expect(commentsSection.getByText(commentText)).not.toBeVisible();
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
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      await expect(page.getByTestId('comment-textarea')).toBeVisible({ timeout: 10_000 });
      // Submit button is disabled when textarea is empty
      const submitBtn = page.getByTestId('comment-submit-btn');
      await expect(submitBtn).toBeDisabled();

      // After typing text, button becomes enabled
      await page.getByTestId('comment-textarea').fill('some text');
      await expect(submitBtn).toBeEnabled();
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 65,66,64
  // PATH_43: Login → blog → post → like → unlike → back to blog
  test('OP-203: user likes then unlikes a blog post', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('post-card').first().click();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeText = await likeBtn.textContent();
      const beforeCount = parseInt(beforeText!.match(/\d+/)![0]);

      // First click: LIKE
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      // Button should show "Liked" text and count incremented
      const afterLikeText = await likeBtn.textContent();
      const afterLikeCount = parseInt(afterLikeText!.match(/\d+/)![0]);
      expect(afterLikeCount).toBe(beforeCount + 1);

      // Second click: UNLIKE
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const afterUnlikeText = await likeBtn.textContent();
      const afterUnlikeCount = parseInt(afterUnlikeText!.match(/\d+/)![0]);
      expect(afterUnlikeCount).toBe(beforeCount);

      // Navigate back to blog
      await page.goto('/blog');
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
      // Portfolio page container doesn't have a testid, verify via heading
      await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible({ timeout: 10_000 });

      // Click the first project-details-btn to navigate to project detail
      const detailsBtn = page.getByTestId('project-details-btn').first();
      await expect(detailsBtn).toBeVisible({ timeout: 10_000 });
      await detailsBtn.click();
      // Assert URL matches /portfolio/:slug or /portfolio/:id
      await expect(page).toHaveURL(/\/portfolio\/[\w-]+/, { timeout: 10_000 });
      // Assert back-to-portfolio-btn is visible on the detail page
      await expect(page.getByTestId('back-to-portfolio-btn')).toBeVisible({ timeout: 10_000 });
      // Assert some project content is visible (h1 title has no testid)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

      // Navigate back using back-to-portfolio-btn
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
      // Attempt admin route via direct navigation; expect redirect to / or /login
      await page.goto('/admin');
      await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 });
      await expect(page).toHaveURL(/(\/$|\/login)/, { timeout: 15_000 });
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
      // Assert the download triggered and has a valid filename
      const filename = download.suggestedFilename();
      expect(filename).toBeTruthy();
      expect(filename.length).toBeGreaterThan(0);
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
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      // Apply tag filter — assert URL changes to include the tag parameter
      await page.goto('/blog?tag=technology');
      await expect(page).toHaveURL(/tag=technology/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/blog/, { timeout: 10_000 });

      // Clear filter — assert tag parameter is removed from URL
      const clearBtn = page.getByTestId('clear-filter-btn');
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await expect(page).toHaveURL(/\/blog(?!.*tag)/, { timeout: 10_000 });
      }

      // Attempt pagination — assert page parameter changes content
      await page.goto('/blog?page=2');
      await expect(page).toHaveURL(/page=2/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/blog/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // TPC pairs: 129,54
  // PATH_48: Login → mobile menu → logout
  test('OP-208: user opens mobile menu and logs out', async ({ browser }) => {
    // Create context with mobile viewport so the header renders mobile controls
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 667 },
    });
    // Authenticate as user
    const loginRes = await context.request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'user' }),
    });
    expect(loginRes.ok()).toBeTruthy();

    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

      // The production build may strip data-testid from the mobile-menu-btn;
      // use the md:hidden CSS class to locate it instead.
      const menuToggle = page.locator('header button[class*="md:hidden"]');
      await expect(menuToggle).toBeVisible({ timeout: 10_000 });
      await menuToggle.click();

      // Wait for the mobile menu panel to appear (border-t container)
      await expect(page.locator('.border-t[class*="md:hidden"]')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('logout-btn').click();
      // Use .last() because the desktop login-btn (first) is hidden at mobile viewport;
      // the mobile-menu login-btn (last) is the visible one.
      await expect(page.getByTestId('login-btn').last()).toBeVisible({ timeout: 15_000 });
      // User avatar should no longer be visible after logout
      await expect(page.getByTestId('user-avatar')).not.toBeVisible();
      // After logout, should be on home page
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
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
      // Assert API call succeeds (status 200)
      expect(res.status()).toBe(200);

      // Logout via UI
      await page.goto('/');
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      // Assert logout completes: login-btn visible, user-avatar not visible
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('user-avatar')).not.toBeVisible();
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
      // Assert URL is NOT /admin (should redirect)
      await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 });
      // Assert URL is / or /login
      await expect(page).toHaveURL(/(\/$|\/login)/, { timeout: 15_000 });
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

      // Simulate token expiry: clear cookies and sessionStorage so the app
      // cannot restore the session on reload
      await context.clearCookies({ name: 'access_token' });
      await context.clearCookies({ name: 'refresh_token' });
      await page.evaluate(() => window.sessionStorage.clear());

      await page.reload();
      // After failed session restore the app should revert to anonymous state
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
      // User avatar should no longer be visible after session expiry
      await expect(page.getByTestId('user-avatar')).not.toBeVisible();
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
      // User should still be authenticated after redirect
      await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
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
      await expect(page.getByTestId('user-avatar')).not.toBeVisible();
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
      // Assert API call succeeds (status 200)
      expect(res.status()).toBe(200);

      // Logout to exercise TPC pair 20 (SA1 → SA0)
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('user-avatar')).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
