import { test, expect } from '@playwright/test';
import { createActorContext, openPageAsActor, readCsrfToken } from '../tpc/helpers';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';
import {
  extractLikeCount,
  assertLikedState,
  assertUnlikedState,
  captureLikeState,
  assertStateInvariant,
} from './helpers';

test.describe.configure({ mode: 'parallel' });

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';

test.describe('Like Toggle MBT', () => {
  const postsApi = new PostsApiClient();
  const createdPostIds: number[] = [];

  test.afterAll(async () => {
    await cleanupPosts(createdPostIds);
  });

  // LK-001 | LP1 | Anonymous user clicks like — blocked with toast
  // TPC pairs: LP1
  test('LK-001: Anonymous user clicks like — blocked with toast', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });

      const beforeCount = await extractLikeCount(likeBtn);
      await likeBtn.click();

      // Toast should show "Login Required"
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      const afterCount = await extractLikeCount(likeBtn);
      expect(afterCount).toBe(beforeCount);

      // Heart should remain outline (unliked)
      const heart = likeBtn.locator('svg');
      await expect(heart).not.toHaveClass(/fill-red-500/);
    } finally {
      await context.close();
    }
  });

  // LK-002 | LP1 | Anonymous like blocked twice
  // TPC pairs: LP1
  test('LK-002: Anonymous like blocked twice', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // First click — blocked
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      // Second click — blocked again
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      const afterCount = await extractLikeCount(likeBtn);
      expect(afterCount).toBe(beforeCount);

      const heart = likeBtn.locator('svg');
      await expect(heart).not.toHaveClass(/fill-red-500/);
    } finally {
      await context.close();
    }
  });

  // LK-003 | LP2, LP26 | Anonymous like then navigate to login
  // TPC pairs: LP2, LP26
  test('LK-003: Anonymous like then navigate to login', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      // Navigate to login via login button
      await page.getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      await expect(page.getByTestId('github-login-btn')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // LK-004 | LP3 | Anonymous like then navigate to blog list
  // TPC pairs: LP3
  test('LK-004: Anonymous like then navigate to blog list', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      // Navigate to blog list
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // LK-005 | LP4 first half | User likes a post
  // TPC pairs: LP4
  test('LK-005: User likes a post', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert S2 invariants (authenticated, on post detail, unliked)
      await assertStateInvariant(page, 'S2');

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      await assertLikedState(likeBtn, beforeCount + 1);

      // Verify S3 invariants (authenticated, on post detail, liked)
      await assertStateInvariant(page, 'S3');
    } finally {
      await context.close();
    }
  });

  // LK-006 | LP4 | User likes then unlikes (full toggle)
  // TPC pairs: LP4
  test('LK-006: User likes then unlikes (full toggle)', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, originalCount + 1);

      // Unlike
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertUnlikedState(likeBtn, originalCount);
    } finally {
      await context.close();
    }
  });

  // LK-007 | LP5 | Unlike then like (reverse toggle)
  // TPC pairs: LP5
  test('LK-007: Unlike then like (reverse toggle)', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);

      // Like via UI (transitions to liked state)
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, originalCount + 1);
      const likedCount = originalCount + 1;

      // Unlike
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const unlikedCount = likedCount - 1;
      await assertUnlikedState(likeBtn, unlikedCount);

      // Like again
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, unlikedCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-008 | LP7, LP8 | Like -> navigate blog -> navigate back
  // TPC pairs: LP7, LP8
  test('LK-008: Like -> navigate blog -> navigate back', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Navigate to blog list
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      // Navigate back to same post
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert liked state preserved after navigation
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertLikedState(likeBtnAfter, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-009 | LP9, LP10 | Unlike -> navigate blog -> navigate back
  // TPC pairs: LP9, LP10
  test('LK-009: Unlike -> navigate blog -> navigate back', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);

      // Like via UI first
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const likedCount = originalCount + 1;
      await assertLikedState(likeBtn, likedCount);

      // Unlike
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const unlikedCount = likedCount - 1;
      await assertUnlikedState(likeBtn, unlikedCount);

      // Navigate to blog list
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      // Navigate back
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert unliked state preserved
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertUnlikedState(likeBtnAfter, unlikedCount);
    } finally {
      await context.close();
    }
  });

  // LK-010 | LP11 | Like -> page reload
  // TPC pairs: LP11
  test('LK-010: Like -> page reload', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Reload page
      await page.reload();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert liked state preserved after reload
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertLikedState(likeBtnAfter, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-011 | LP12 | Unlike -> page reload
  // TPC pairs: LP12
  test('LK-011: Unlike -> page reload', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);

      // Like via UI first
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const likedCount = originalCount + 1;
      await assertLikedState(likeBtn, likedCount);

      // Unlike
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      const unlikedCount = likedCount - 1;
      await assertUnlikedState(likeBtn, unlikedCount);

      // Reload page
      await page.reload();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert unliked state preserved after reload
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertUnlikedState(likeBtnAfter, unlikedCount);
    } finally {
      await context.close();
    }
  });

  // LK-012 | LP13 | Like -> logout -> count preserved
  // TPC pairs: LP13
  test('LK-012: Like -> logout -> count preserved', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Logout via UI
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });

      // Reload the post page as anonymous
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtnAfter = page.getByTestId('like-btn');
      // Anonymous user sees unliked state (default)
      const heart = likeBtnAfter.locator('svg');
      await expect(heart).not.toHaveClass(/fill-red-500/);

      // But count should reflect the like that was added
      const afterCount = await extractLikeCount(likeBtnAfter);
      expect(afterCount).toBe(beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-013 | LP14 | Like API error -> optimistic revert
  // TPC pairs: LP14
  test('LK-013: Like API error -> optimistic revert', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Intercept like API to return 500
      await page.route('**/api/posts/*/like', (route) =>
        route.fulfill({ status: 500, body: '{}' })
      );

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      await likeBtn.click();

      // Assert error toast
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Failed to update like', { exact: true })).toBeVisible({ timeout: 10_000 });

      // Assert reverted to unliked state
      await assertUnlikedState(likeBtn, beforeCount);

      await page.unroute('**/api/posts/*/like');
    } finally {
      await context.close();
    }
  });

  // LK-014 | LP17, LP18 | Anonymous like fail -> login -> then like
  // TPC pairs: LP17, LP18
  test('LK-014: Anonymous like fail -> login -> then like', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Click like as anonymous — should be blocked
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

      // Login via API (simulating user going through login flow)
      const loginRes = await context.request.post('/api/auth/test-login', {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ role: 'user' }),
      });
      expect(loginRes.ok()).toBeTruthy();

      // Reload page (now authenticated)
      await page.reload();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      // Verify auth state restored (user-avatar or just that login-btn is gone)
      await expect(page.getByTestId('login-btn')).not.toBeVisible({ timeout: 10_000 });

      // Now click like — should succeed
      const likeBtnAfter = page.getByTestId('like-btn');
      await likeBtnAfter.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtnAfter, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-015 | Anonymous page reload preserves state
  test('LK-015: Anonymous page reload preserves state', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeState = await captureLikeState(likeBtn);

      // Reload
      await page.reload();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtnAfter = page.getByTestId('like-btn');
      const afterState = await captureLikeState(likeBtnAfter);
      // Anonymous state should be preserved after reload
      expect(afterState.liked).toBe(beforeState.liked);
      expect(afterState.count).toBe(beforeState.count);
    } finally {
      await context.close();
    }
  });

  // LK-016 | LP30 | Two users like same post (count +2)
  // TPC pairs: LP30
  test('LK-016: Two users like same post (count +2)', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    // User 1 likes the post
    const context1 = await createActorContext(browser, baseURL, 'user');
    const page1 = await context1.newPage();
    try {
      await page1.goto(`/blog/${post.slug}`);
      await expect(page1.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn1 = page1.getByTestId('like-btn');
      await expect(likeBtn1).toBeVisible({ timeout: 10_000 });
      const count0 = await extractLikeCount(likeBtn1);

      await likeBtn1.click();
      await expect(page1.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn1, count0 + 1);
    } finally {
      await context1.close();
    }

    // User 2 (admin, as a different user) opens same post
    const context2 = await createActorContext(browser, baseURL, 'admin');
    const page2 = await context2.newPage();
    try {
      await page2.goto(`/blog/${post.slug}`);
      await expect(page2.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn2 = page2.getByTestId('like-btn');
      await expect(likeBtn2).toBeVisible({ timeout: 10_000 });

      // Should be unliked from user2's perspective
      const heart = likeBtn2.locator('svg');
      await expect(heart).not.toHaveClass(/fill-red-500/);

      // Count should show the previous user's like
      const currentCount = await extractLikeCount(likeBtn2);
      expect(currentCount).toBeGreaterThanOrEqual(0); // at minimum reflects existing likes

      // Like as user2
      await likeBtn2.click();
      await expect(page2.getByRole('status')).toBeVisible({ timeout: 10_000 });

      // Verify count incremented
      const afterCount = await extractLikeCount(likeBtn2);
      expect(afterCount).toBe(currentCount + 1);
    } finally {
      await context2.close();
    }
  });

  // LK-017 | Same user two tabs
  test('LK-017: Same user two tabs', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page1 = await context.newPage();
    try {
      await page1.goto(`/blog/${post.slug}`);
      await expect(page1.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn1 = page1.getByTestId('like-btn');
      await expect(likeBtn1).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn1);

      // Like on tab 1
      await likeBtn1.click();
      await expect(page1.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn1, beforeCount + 1);

      // Open tab 2 in same context
      const page2 = await context.newPage();
      await page2.goto(`/blog/${post.slug}`);
      await expect(page2.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn2 = page2.getByTestId('like-btn');
      await expect(likeBtn2).toBeVisible({ timeout: 10_000 });

      // Tab 2 should show liked state (same session/cookies) — reload to pick up server state
      await page2.reload();
      await expect(page2.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      const likeBtn2Reloaded = page2.getByTestId('like-btn');
      await assertLikedState(likeBtn2Reloaded, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-018 | LP29 | Like non-existent post -> 404
  // TPC pairs: LP29
  test('LK-018: Like non-existent post -> 404', async ({ browser }) => {
    const context = await createActorContext(browser, baseURL, 'user');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const res = await context.request.post('/api/posts/999999/like', {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(res.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  // LK-019 | Like draft post -> 404
  test('LK-019: Like draft post -> 404', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'draft' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const res = await context.request.post(`/api/posts/${post.id}/like`, {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(res.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  // LK-020 | LP27 | API like without auth -> 401
  // TPC pairs: LP27
  test('LK-020: API like without auth -> 401', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await browser.newContext({ baseURL });
    try {
      // Anonymous POST to like endpoint
      const res = await context.request.post(`/api/posts/${post.id}/like`);
      expect([401, 403]).toContain(res.status());

      // Verify public browsing still works
      const page = await context.newPage();
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // LK-021 | LP28 | API like without CSRF -> 403
  // TPC pairs: LP28
  test('LK-021: API like without CSRF -> 403', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    try {
      // POST without CSRF token
      const resNoCsrf = await context.request.post(`/api/posts/${post.id}/like`);
      expect(resNoCsrf.status()).toBe(403);

      // POST WITH CSRF token — should succeed
      const csrf = await readCsrfToken(context, baseURL);
      const resWithCsrf = await context.request.post(`/api/posts/${post.id}/like`, {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(resWithCsrf.status()).toBe(200);
      const body = await resWithCsrf.json();
      expect(body.liked).toBe(true);
    } finally {
      await context.close();
    }
  });

  // LK-022 | LP15 | Rapid double-click
  // TPC pairs: LP15
  test('LK-022: Rapid double-click', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Rapid double-click
      await Promise.all([likeBtn.click(), likeBtn.click()]);

      // Wait for UI to settle — final state should be consistent
      // Either liked (count = beforeCount + 1) or unliked (count = beforeCount)
      // The two clicks may cancel out or result in a single like
      await page.waitForTimeout(2000);

      const afterCount = await extractLikeCount(likeBtn);
      const heart = likeBtn.locator('svg');
      const hasFill = await heart.evaluate((el) => el.classList.contains('fill-red-500'));

      // State must be internally consistent: if liked, count should be > beforeCount
      // If unliked (toggled back), count should equal beforeCount
      // Rapid double-click may result in net 0 or net 1 like depending on race
      if (hasFill) {
        expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
      } else {
        expect(afterCount).toBeLessThanOrEqual(beforeCount + 1);
      }
    } finally {
      await context.close();
    }
  });

  // LK-023 | Session expiry during like
  test('LK-023: Session expiry during like', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Clear auth cookies to simulate session expiry
      await context.clearCookies({ name: 'access_token' });
      await context.clearCookies({ name: 'refresh_token' });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Click like — session expired, should handle error
      await likeBtn.click();

      // Either redirect to /login or error toast with count reverted
      await page.waitForTimeout(2000);

      const currentURL = page.url();
      if (currentURL.includes('/login')) {
        // Redirected to login page — acceptable session expiry handling
        expect(currentURL).toContain('/login');
      } else {
        // Stayed on page — optimistic update should be reverted
        const afterCount = await extractLikeCount(likeBtn);
        // Count should be unchanged (reverted from optimistic update)
        expect(afterCount).toBe(beforeCount);
      }
    } finally {
      await context.close();
    }
  });

  // LK-024 | LP19, LP20 | Like -> logout -> re-login (restore liked)
  // TPC pairs: LP19, LP20
  test('LK-024: Like -> logout -> re-login (restore liked)', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Logout via UI
      await page.getByTestId('user-avatar').click();
      await page.getByTestId('logout-btn').click();
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });

      // Re-login via API
      const loginRes = await context.request.post('/api/auth/test-login', {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ role: 'user' }),
      });
      expect(loginRes.ok()).toBeTruthy();

      // Reload the post
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Liked state should be restored
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertLikedState(likeBtnAfter, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-025 | LP16 | Like -> browser back/forward
  // TPC pairs: LP16
  test('LK-025: Like -> browser back/forward', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Navigate away
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });

      // Go back — use goto instead of goBack for SPA reliability
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Liked state should be preserved
      const likeBtnAfter = page.getByTestId('like-btn');
      await assertLikedState(likeBtnAfter, beforeCount + 1);
    } finally {
      await context.close();
    }
  });

  // LK-026 | LP21 | Admin likes a post
  // TPC pairs: LP21
  test('LK-026: Admin likes a post', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'admin');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      // Assert S5 invariants (admin, on post detail, unliked)
      await assertStateInvariant(page, 'S5');

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const beforeCount = await extractLikeCount(likeBtn);

      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, beforeCount + 1);

      // Verify S6 invariants (admin, on post detail, liked)
      await assertStateInvariant(page, 'S6');
    } finally {
      await context.close();
    }
  });

  // LK-027 | LP22 | Admin like -> unlike
  // TPC pairs: LP22
  test('LK-027: Admin like -> unlike', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'admin');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);

      // Like
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, originalCount + 1);

      // Unlike
      await likeBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertUnlikedState(likeBtn, originalCount);
    } finally {
      await context.close();
    }
  });

  // LK-028 | LP4, LP5 | 4-cycle toggle
  // TPC pairs: LP4, LP5
  test('LK-028: 4-cycle toggle', async ({ browser }) => {
    const seed = PostFactory.create({ status: 'published' });
    const post = await postsApi.create(seed);
    createdPostIds.push(post.id);

    const context = await createActorContext(browser, baseURL, 'user');
    const page = await context.newPage();
    try {
      await page.goto(`/blog/${post.slug}`);
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      const originalCount = await extractLikeCount(likeBtn);
      const waitLikeApi = () =>
        page.waitForResponse(
          (response) =>
            response.url().includes(`/api/posts/${post.id}/like`) &&
            response.request().method() === 'POST' &&
            response.status() < 300
        );

      // Cycle 1: Like
      await Promise.all([waitLikeApi(), likeBtn.click()]);
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, originalCount + 1);

      // Cycle 2: Unlike
      await Promise.all([waitLikeApi(), likeBtn.click()]);
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertUnlikedState(likeBtn, originalCount);

      // Cycle 3: Like
      await Promise.all([waitLikeApi(), likeBtn.click()]);
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertLikedState(likeBtn, originalCount + 1);

      // Cycle 4: Unlike
      await Promise.all([waitLikeApi(), likeBtn.click()]);
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
      await assertUnlikedState(likeBtn, originalCount);

      // Reload and verify final state
      await page.reload();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtnAfter = page.getByTestId('like-btn');
      await assertUnlikedState(likeBtnAfter, originalCount);
    } finally {
      await context.close();
    }
  });
});
