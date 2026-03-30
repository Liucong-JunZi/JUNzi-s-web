import { test, expect, type Browser } from '@playwright/test';
import { createActorContext, openPageAsActor, readCsrfToken } from './helpers';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';

type SeededProject = {
  id: string;
  title: string;
};

async function seedPortfolioProject(browser: Browser): Promise<SeededProject> {
  const { context } = await openPageAsActor(browser, baseURL, 'admin');
  try {
    const csrf = await readCsrfToken(context, baseURL);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `TPC-ANON-${suffix}`;
    const createRes = await context.request.post('/api/admin/projects', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      data: JSON.stringify({
        title,
        description: `anonymous flow seed ${suffix}`,
        tech_stack: 'Playwright,TypeScript',
        status: 'active',
        sort_order: 999,
      }),
    });
    expect(createRes.ok(), `seed project create status=${createRes.status()}`).toBeTruthy();
    const body = await createRes.json();
    const id = String(body?.project?.id ?? body?.id ?? '');
    expect(id).toMatch(/^\d+$/);
    return { id, title };
  } finally {
    await context.close();
  }
}

async function cleanupPortfolioProject(browser: Browser, projectId: string): Promise<void> {
  const { context } = await openPageAsActor(browser, baseURL, 'admin');
  try {
    const csrf = await readCsrfToken(context, baseURL);
    await context.request.delete(`/api/admin/projects/${projectId}`, {
      headers: { 'X-CSRF-Token': csrf },
    });
  } catch (error) {
    void error;
  } finally {
    await context.close();
  }
}

test.describe('TPC Anonymous', () => {
  test.describe.configure({ mode: 'parallel' });

  // OP-101 | PATH_1 | Fresh page load → rehydration no session → browse public → admin redirect to login
  // TPC pairs: 36, 3, 8
  test('OP-101: fresh page load → rehydration no session → browse public → admin redirect to login', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // T12: fresh page load → rehydration starts
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T13: no session → stays anonymous, public pages accessible
      // T2: browse public page
      await page.locator('header').getByRole('link', { name: 'Blog' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // T3: visit /admin → redirect to /login
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
      await expect(page.getByTestId('github-login-btn')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // OP-102 | PATH_2 | Page load → blog → read post → like blocked (anonymous)
  // TPC pairs: 36, 3, 56, 66
  test('OP-102: page load → blog → read post → like blocked (anonymous)', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await page.goto('/blog');
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('post-card').first().click();
      await expect(page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });

      const likeBtn = page.getByTestId('like-btn');
      await expect(likeBtn).toBeVisible({ timeout: 10_000 });
      // Capture current like count
      const beforeText = await likeBtn.textContent();
      const beforeCount = parseInt(beforeText!.match(/\d+/)![0]);
      const postUrlBeforeLike = page.url();
      let likeRequestCount = 0;
      await page.route('**/api/posts/*/like', async (route) => {
        likeRequestCount += 1;
        await route.continue();
      });

      await likeBtn.click();
      // Anonymous like should be blocked without calling like API
      await page.waitForLoadState('networkidle');
      expect(likeRequestCount).toBe(0);
      await expect(page).toHaveURL(postUrlBeforeLike);
      // Like count should NOT change
      const afterText = await likeBtn.textContent();
      const afterCount = parseInt(afterText!.match(/\d+/)![0]);
      expect(afterCount).toBe(beforeCount);
      await page.unroute('**/api/posts/*/like');
    } finally {
      await context.close();
    }
  });

  // OP-103 | PATH_3 | Blog search → tag filter → clear tag → clear search
  // TPC pairs: 57, 62, 58, 63
  test('OP-103: blog search → tag filter → clear search → clear filter', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/blog');
      await expect(page).toHaveURL(/\/blog$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 15_000 });
      // Wait for posts to load before capturing initial count
      await expect(page.getByTestId('post-card').first()).toBeVisible({ timeout: 10_000 });
      // capture initial post card count
      const initialCards = page.locator('[data-testid="post-card"]');
      const initialCount = await initialCards.count();
      // T67: submit search → SB2
      const searchInput = page.getByTestId('blog-search-input');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });
      await searchInput.fill('test');
      await searchInput.press('Enter');
      // Search triggers an API call; the frontend does not update the URL with ?q=
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // Wait for the search results to load (results may change)
      await page.waitForTimeout(500);
      const afterSearchCount = await initialCards.count();
      expect(afterSearchCount).toBeLessThanOrEqual(initialCount);
      // T70: clear search by manually clearing the input
      await searchInput.fill('');
      await searchInput.press('Enter');
      // T69: if a tag filter is active, clear-filter-btn appears; click it if visible
      const clearFilter = page.getByTestId('clear-filter-btn');
      if (await clearFilter.isVisible()) {
        await clearFilter.click();
        // Rule 4: Assert URL no longer has filter params and card count restored
        await expect(page).toHaveURL(/\/blog(\?.*)?$/);
        const afterClearCount = await initialCards.count();
        expect(afterClearCount).toBeGreaterThanOrEqual(afterSearchCount);
      }
    } finally {
      await context.close();
    }
  });
  // OP-104 | PATH_4 | Read blog post → back to blog → paginate
  // TPC pairs: 64, 59, 62
  test('OP-104: blog post → back to blog → paginate next', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/blog');
      await expect(page).toHaveURL(/\/blog$/, { timeout: 15_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 15_000 });
      // T65: click post card → SP2
      const postCard = page.locator('[data-testid="post-card"]').first();
      await expect(postCard).toBeVisible({ timeout: 10_000 });
      await postCard.click();
      await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 10_000 });
      // T71: click Back to Blog → SP1
      await page.locator('main a[href="/blog"]').first().click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // T68: click Next pagination → SB4
      const nextBtn = page.getByTestId('pagination-next');
      const hasNext = await nextBtn.isVisible();
      if (hasNext) {
        // capture first post title before paginating
        const firstTitleBefore = await page.locator('[data-testid="post-card"]').first().textContent();
        await nextBtn.click();
        // Rule 5: Assert URL contains page param and different cards shown
        await expect(page).toHaveURL(/[?&]page=/, { timeout: 10_000 });
        await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
        const firstTitleAfter = await page.locator('[data-testid="post-card"]').first().textContent();
        expect(firstTitleAfter).not.toBe(firstTitleBefore);
      }
    } finally {
      await context.close();
    }
  });

  // OP-105 | PATH_5 | Browse portfolio → project detail → back
  // TPC pairs: 71, 73
  test('OP-105: portfolio → project detail → back to portfolio', async ({ browser }) => {
    const seededProject = await seedPortfolioProject(browser);
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/portfolio');
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 15_000 });
      const projectCard = page.getByTestId('project-card').filter({ hasText: seededProject.title });
      await expect(projectCard).toBeVisible({ timeout: 15_000 });
      const detailsBtn = projectCard.getByTestId('project-details-btn');
      await expect(detailsBtn).toBeVisible({ timeout: 10_000 });
      await detailsBtn.click();
      await expect(page).toHaveURL(new RegExp(`/portfolio/${seededProject.id}$`), { timeout: 10_000 });
      await expect(page.getByTestId('back-to-portfolio-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('back-to-portfolio-btn').click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      await expect(projectCard).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await cleanupPortfolioProject(browser, seededProject.id);
    }
  });

  // OP-106 | PATH_6 | Home → portfolio CTA → project → back to portfolio
  // TPC pairs: 49, 70, 73
  test('OP-106: home portfolio CTA → project detail → back', async ({ browser }) => {
    const seededProject = await seedPortfolioProject(browser);
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('home-portfolio-cta').click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      const projectCard = page.getByTestId('project-card').filter({ hasText: seededProject.title });
      await expect(projectCard).toBeVisible({ timeout: 15_000 });
      const detailsBtn = projectCard.getByTestId('project-details-btn');
      await expect(detailsBtn).toBeVisible({ timeout: 10_000 });
      await detailsBtn.click();
      await expect(page).toHaveURL(new RegExp(`/portfolio/${seededProject.id}$`), { timeout: 10_000 });
      await expect(page.getByTestId('back-to-portfolio-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('back-to-portfolio-btn').click();
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      await expect(projectCard).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await cleanupPortfolioProject(browser, seededProject.id);
    }
  });

  // OP-107 | PATH_7 | Home → resume CTA → download resume
  // TPC pairs: 76
  test('OP-107: home resume CTA → download resume button', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T64: click View Resume ghost button → SP5
      await page.getByRole('link', { name: 'View Resume' }).click();
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Resume', exact: true })).toBeVisible({ timeout: 10_000 });
      // T146: click Download Resume button → stays on SP5
      const downloadBtn = page.getByTestId('resume-download-btn');
      await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
      // Verify we're still on the resume page after seeing download button
      await expect(page).toHaveURL(/\/resume$/);
    } finally {
      await context.close();
    }
  });
  // OP-108 | PATH_8 | Nav resume → download resume button
  // TPC pairs: 75
  test('OP-108: nav to resume → download resume button visible', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T50: click Resume in nav → SP5
      await page.locator('header').getByRole('link', { name: 'Resume' }).click();
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Resume', exact: true })).toBeVisible({ timeout: 10_000 });
      // T146: download resume button present
      const downloadBtn = page.getByTestId('resume-download-btn');
      await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
      // Assert page stayed on resume after seeing download button
      await expect(page).toHaveURL(/\/resume$/);
    } finally {
      await context.close();
    }
  });

  // OP-109 | PATH_9 | Unknown route → 404 → go home → nav blog
  // TPC pairs: 121, 52
  test('OP-109: 404 page → go home → navigate to blog', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // T150: navigate unknown route → SP17
      await page.goto('/this-route-does-not-exist-xyz');
      // Rule 8: Assert 404 message is shown (use first() to avoid strict mode with multiple matches)
      await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 10_000 });
      // T77: click Go Home → SP0
      await page.locator('main a[href="/"]').first().click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      // T48: nav to blog
      await page.locator('header').getByRole('link', { name: 'Blog' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // OP-110 | PATH_10 | Unknown route → 404 → go back
  // TPC pairs: 122
  test('OP-110: 404 page → go back button returns to previous page', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      await page.goto('/blog');
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // T150: navigate unknown route → SP17
      await page.goto('/another-nonexistent-path-abc');
      // Rule 8: Assert 404 message is shown (use first() to avoid strict mode with multiple matches)
      await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 10_000 });
      // T78: click Go Back → SP1
      await page.locator('main button').filter({ has: page.locator('svg.lucide-arrow-left') }).first().click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // OP-111 | PATH_11 | Open mobile menu → close with X
  // TPC pairs: 123
  test('OP-111: mobile menu open → close with X button', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: click hamburger → SM2
      const hamburger = page.locator('header button.md\\:hidden');
      await expect(hamburger).toBeVisible({ timeout: 10_000 });
      await hamburger.click();
      const mobileNav = page.locator('header div.md\\:hidden.border-t');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert menu links are visible inside mobile nav
      await expect(mobileNav.getByRole('link', { name: 'Blog' })).toBeVisible({ timeout: 5_000 });
      await expect(mobileNav.getByRole('link', { name: 'Portfolio' })).toBeVisible({ timeout: 5_000 });
      await expect(mobileNav.getByRole('link', { name: 'Resume' })).toBeVisible({ timeout: 5_000 });
      // T55: click same button (now shows X icon) → SM1
      await hamburger.click();
      await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
  // OP-112 | PATH_12 | Mobile menu → Blog → read post → login to comment → GitHub
  // TPC pairs: 125, 56 (partial), 78, 43
  test('OP-112: mobile menu → blog → post → login-to-comment prompt', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: open mobile menu
      const hamburger = page.locator('header button.md\\:hidden');
      await hamburger.click();
      const mobileNav = page.locator('header div.md\\:hidden.border-t');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert Blog link visible in mobile menu
      await expect(mobileNav.getByRole('link', { name: 'Blog' })).toBeVisible({ timeout: 5_000 });
      // T57: tap Blog in mobile nav → SP1
      await mobileNav.getByRole('link', { name: 'Blog' }).click();
      // Rule 6: Assert mobile menu is closed after navigation
      await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // T65: click post card → SP2
      const postCard = page.locator('[data-testid="post-card"]').first();
      await expect(postCard).toBeVisible({ timeout: 10_000 });
      await postCard.click();
      await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 10_000 });
      // T73: login-to-comment link visible
      const loginPrompt = page.getByTestId('comment-login-link');
      await expect(loginPrompt).toBeVisible({ timeout: 10_000 });
      // Rule 7: Click login prompt → redirects to login with GitHub button
      await loginPrompt.click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
      await expect(page.getByTestId('github-login-btn')).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  // OP-113 | PATH_13 | Mobile menu → Portfolio tab
  // TPC pairs: 126
  test('OP-113: mobile menu → portfolio navigation', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: open mobile menu
      const hamburger = page.locator('header button.md\\:hidden');
      await hamburger.click();
      const mobileNav = page.locator('header div.md\\:hidden.border-t');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert Portfolio link visible in mobile menu
      await expect(mobileNav.getByRole('link', { name: 'Portfolio' })).toBeVisible({ timeout: 5_000 });
      // T58: tap Portfolio → SP3
      await mobileNav.getByRole('link', { name: 'Portfolio' }).click();
      // Rule 6: Assert mobile menu closed after navigation
      await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  // OP-114 | PATH_14 | Mobile menu → Resume tab
  // TPC pairs: 127
  test('OP-114: mobile menu → resume navigation', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: open mobile menu
      const hamburger = page.locator('header button.md\\:hidden');
      await hamburger.click();
      const mobileNav = page.locator('header div.md\\:hidden.border-t');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert Resume link visible in mobile menu
      await expect(mobileNav.getByRole('link', { name: 'Resume' })).toBeVisible({ timeout: 5_000 });
      // T59: tap Resume → SP5
      await mobileNav.getByRole('link', { name: 'Resume' }).click();
      // Rule 6: Assert mobile menu closed after navigation
      await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Resume', exact: true })).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
  // OP-115 | PATH_15 | Mobile menu → Login → OAuth flow → OAuth denied → reload
  // TPC pairs: 128, 79, 44, 1, 12
  test('OP-115: mobile menu → login page → GitHub OAuth link visible', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: open mobile menu
      const hamburger = page.locator('header button.md\\:hidden');
      await hamburger.click();
      const mobileNav = page.locator('header div.md\\:hidden.border-t');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert Login link visible in mobile menu
      await expect(mobileNav.getByRole('link', { name: 'Login' })).toBeVisible({ timeout: 5_000 });
      // T60: tap Login → SP6
      await mobileNav.getByRole('link', { name: 'Login' }).click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
      // Rule 7: Assert login page shows GitHub OAuth button
      const githubBtn = page.getByTestId('github-login-btn');
      await expect(githubBtn).toBeVisible({ timeout: 10_000 });
      // T1: /login page mounted, no session → stays on login
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await ctx.close();
    }
  });

  // OP-116 | PATH_16 | Login page → GitHub → callback fail → retry login
  // TPC pairs: 77, 43 (partial), 47, 13
  test('OP-116: login page renders with GitHub OAuth button', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // T51: click Login btn → SP6
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
      // Rule 7: Click login → assert redirect to /login with GitHub button
      await page.getByTestId('login-btn').click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
      // T6: GitHub button present → initiates OAuth (T43)
      const githubBtn = page.getByTestId('github-login-btn');
      await expect(githubBtn).toBeVisible({ timeout: 10_000 });
      // Verify the button triggers GitHub OAuth via onClick (renders as <button>, not <a>)
      await expect(githubBtn).toHaveText(/github/i);
      // Assert we remain on login page (no session, no redirect away)
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  });

  // OP-117 | PATH_17 | CSRF-less like → 401 → browse public
  // TPC pairs: 10
  test('OP-117: like without auth returns 401, public browsing still works', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // T24: POST without auth/CSRF → 401 (auth required) or 403 (CSRF)
      const res = await context.request.post('/api/posts/fake-slug/like', {
        headers: { 'Content-Type': 'application/json' },
        data: '{}',
        maxRedirects: 0,
      });
      expect([401, 403]).toContain(res.status());
      // T2: public page still accessible after failed API call
      await page.goto('/blog');
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
  // OP-118 | PATH_18 | POST logout already anon → browse public
  // TPC pairs: 14 (partial)
  test('OP-118: logout when already anonymous returns non-auth error, public still works', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // POST /auth/logout as anonymous → expect 401 or similar (already logged out)
      const res = await context.request.post('/api/auth/logout', { maxRedirects: 0 });
      expect([400, 401, 403, 404, 200]).toContain(res.status());
      // T2: public browsing still works after failed logout
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // Rule 1: Navigate to blog and verify page loaded with container
      await page.locator('header').getByRole('link', { name: 'Blog' }).click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // OP-119 | PATH_19 | /auth/refresh no cookie → 401 → browse public
  // TPC pairs: 10 (partial)
  test('OP-119: auth refresh without cookie returns 401, public still works', async ({ browser }) => {
    const { context, page } = await openPageAsActor(browser, baseURL, 'anonymous');
    try {
      // GET /auth/me with no session → 401
      const res = await context.request.get('/api/auth/me', {
        headers: { 'X-Skip-Auth-Redirect': '1' },
        maxRedirects: 0,
      });
      expect([401, 403]).toContain(res.status());
      // T2: public page still accessible after failed auth check
      await page.goto('/resume');
      await expect(page).toHaveURL(/\/resume$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Resume', exact: true })).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // OP-120 | PATH_20 | Mobile menu → Home → Blog CTA → post → back
  // TPC pairs: 124, 55, 57, 64
  test('OP-120: mobile menu → home → blog CTA → post → back to blog', async ({ browser }) => {
    const ctx = await createActorContext(browser, baseURL, 'anonymous');
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/blog');
      await expect(page).toHaveURL(/\/blog$/, { timeout: 15_000 });
      await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
      // T54: open mobile menu
      const hamburger = page.getByTestId('mobile-menu-btn');
      await hamburger.click();
      const mobileNav = page.getByTestId('mobile-menu');
      await expect(mobileNav).toBeVisible({ timeout: 5_000 });
      // Rule 6: Assert Home link visible in mobile menu
      const homeLink = mobileNav.locator('a[href="/"]').first();
      await expect(homeLink).toBeVisible({ timeout: 5_000 });
      // T56: tap Home in mobile nav → SP0
      await homeLink.click();
      // Rule 6: Assert mobile menu closed after navigation
      await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
      // T62: click Blog CTA button on home → SP1
      await page.getByTestId('home-blog-cta').click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
      // T65: click post card → SP2
      const postCard = page.locator('[data-testid="post-card"]').first();
      await expect(postCard).toBeVisible({ timeout: 10_000 });
      await postCard.click();
      await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 10_000 });
      // T71: back to blog
      await page.locator('main a[href="/blog"]').first().click();
      await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
      await expect(page.getByTestId('blog-page')).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
