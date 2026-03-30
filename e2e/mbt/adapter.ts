/**
 * MBT Adapter Layer
 *
 * Maps each abstract TransitionType to a concrete Playwright action on the SUT.
 * This is the bridge between the state-machine model and the real system.
 *
 * Each adapter function:
 * 1. Performs the Playwright action on the SUT
 * 2. Returns the new model state (what the model expects after this transition)
 */

import { expect, type Page, type BrowserContext } from '@playwright/test';
import {
  type AppState,
  ActorStates,
  PageStates,
  EntityStates,
} from './models/stateMachine';
import { type TransitionType } from './models/transitions';

// ---------------------------------------------------------------------------
// Adapter context
// ---------------------------------------------------------------------------

export interface AdapterContext {
  page: Page;
  context: BrowserContext;
  baseURL: string;
  /** Runtime state that the adapter tracks across transitions */
  data: {
    currentPostSlug?: string;
    currentPostId?: number;
    currentCommentId?: number;
    currentProjectId?: number;
    currentResumeId?: number;
  };
}

/** Result of a transition adapter: the delta to merge into the model state. */
export type TransitionAdapter = (
  ctx: AdapterContext,
  fromState: AppState,
) => Promise<Partial<AppState>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a PageState enum value to a concrete URL path. */
function pageUrl(
  pageState: typeof PageStates[keyof typeof PageStates],
  data: AdapterContext['data'],
): string {
  switch (pageState) {
    case PageStates.HOME:
      return '/';
    case PageStates.BLOG_LIST:
      return '/blog';
    case PageStates.BLOG_POST:
      return data.currentPostSlug
        ? `/blog/${data.currentPostSlug}`
        : '/blog';
    case PageStates.PORTFOLIO_LIST:
      return '/portfolio';
    case PageStates.PORTFOLIO_DETAIL:
      return data.currentProjectId
        ? `/portfolio/${data.currentProjectId}`
        : '/portfolio';
    case PageStates.RESUME:
      return '/resume';
    case PageStates.LOGIN:
      return '/login';
    case PageStates.AUTH_CALLBACK:
      return '/auth/callback';
    case PageStates.ADMIN_DASHBOARD:
      return '/admin';
    case PageStates.ADMIN_POSTS:
      return '/admin/posts';
    case PageStates.ADMIN_POST_EDITOR:
      return data.currentPostId
        ? `/admin/posts/${data.currentPostId}`
        : '/admin/posts/new';
    case PageStates.ADMIN_PROJECTS:
      return '/admin/projects';
    case PageStates.ADMIN_PROJECT_EDITOR:
      return data.currentProjectId
        ? `/admin/projects/${data.currentProjectId}`
        : '/admin/projects/new';
    case PageStates.ADMIN_COMMENTS:
      return '/admin/comments';
    case PageStates.ADMIN_RESUME:
      return '/admin/resume';
    default:
      return '/';
  }
}

/** Read the CSRF token from the browser context cookies. */
async function readCsrfToken(ctx: AdapterContext): Promise<string> {
  const cookies = await ctx.context.cookies(ctx.baseURL);
  const token = cookies.find((c) => c.name === 'csrf_token')?.value || '';
  return token;
}

/** Generate a unique suffix for test data. */
function uid(): string {
  return `${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Adapter implementations
// ---------------------------------------------------------------------------

const adapters: Record<TransitionType, TransitionAdapter> = {

  // --- Navigation -----------------------------------------------------------

  async nav(ctx, fromState) {
    const target = fromState.page;
    const url = pageUrl(target, ctx.data);
    await ctx.page.goto(url);
    await expect(ctx.page.locator('header')).toBeVisible({ timeout: 10_000 });
    return { page: target };
  },

  // --- Auth -----------------------------------------------------------------

  async login(ctx) {
    const res = await ctx.context.request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'user' }),
    });
    expect(res.ok(), `test-login status=${res.status()}`).toBeTruthy();

    await ctx.page.reload();
    await expect(ctx.page.locator('header')).toBeVisible({ timeout: 10_000 });

    return { actor: ActorStates.USER };
  },

  async logout(ctx) {
    // Prefer UI logout when the avatar is visible (matches real user flow)
    const avatar = ctx.page.getByTestId('user-avatar');
    if (await avatar.isVisible()) {
      await avatar.click();
      const logoutBtn = ctx.page.getByTestId('logout-btn');
      await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
      await logoutBtn.click();
      await expect(ctx.page.getByTestId('login-btn')).toBeVisible({ timeout: 15_000 });
    } else {
      // Fallback: API logout
      await ctx.context.request.post('/api/auth/logout');
      await ctx.page.reload();
    }
    return { actor: ActorStates.ANONYMOUS };
  },

  // --- Like / Unlike --------------------------------------------------------

  async like(ctx, fromState) {
    // Ensure we are on a blog post page
    if (fromState.page !== PageStates.BLOG_POST) {
      if (ctx.data.currentPostSlug) {
        await ctx.page.goto(`/blog/${ctx.data.currentPostSlug}`);
        await expect(ctx.page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      }
    }

    const likeBtn = ctx.page.getByTestId('like-btn');
    await expect(likeBtn).toBeVisible({ timeout: 10_000 });
    await likeBtn.click();
    await expect(ctx.page.getByRole('status')).toBeVisible({ timeout: 10_000 });

    return { entity: { like: EntityStates.LIKED } };
  },

  async unlike(ctx, fromState) {
    // Ensure we are on a blog post page
    if (fromState.page !== PageStates.BLOG_POST) {
      if (ctx.data.currentPostSlug) {
        await ctx.page.goto(`/blog/${ctx.data.currentPostSlug}`);
        await expect(ctx.page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      }
    }

    const likeBtn = ctx.page.getByTestId('like-btn');
    await expect(likeBtn).toBeVisible({ timeout: 10_000 });
    await likeBtn.click();
    await expect(ctx.page.getByRole('status')).toBeVisible({ timeout: 10_000 });

    return { entity: { like: EntityStates.UNLIKED } };
  },

  async like_denied(ctx, fromState) {
    // Ensure we are on a blog post page as anonymous
    if (fromState.page !== PageStates.BLOG_POST) {
      if (ctx.data.currentPostSlug) {
        await ctx.page.goto(`/blog/${ctx.data.currentPostSlug}`);
        await expect(ctx.page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      }
    }

    const likeBtn = ctx.page.getByTestId('like-btn');
    await expect(likeBtn).toBeVisible({ timeout: 10_000 });
    await likeBtn.click();

    // Toast with role="status" should appear
    await expect(ctx.page.getByRole('status')).toBeVisible({ timeout: 10_000 });

    return { entity: { like: EntityStates.UNLIKED } };
  },

  // --- Comments -------------------------------------------------------------

  async submit_comment(ctx, fromState) {
    // Ensure we are on a blog post page
    if (fromState.page !== PageStates.BLOG_POST) {
      if (ctx.data.currentPostSlug) {
        await ctx.page.goto(`/blog/${ctx.data.currentPostSlug}`);
        await expect(ctx.page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      }
    }

    const commentText = `MBT comment ${uid()}`;
    const textarea = ctx.page.getByTestId('comment-textarea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill(commentText);

    const [submitRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes('/api/comments') && r.request().method() === 'POST',
      ),
      ctx.page.getByTestId('comment-submit-btn').click(),
    ]);
    expect(submitRes.status()).toBeLessThan(300);

    // Track the comment id from the response
    const body = await submitRes.json();
    const commentId = body.comment?.id || body.id;
    if (commentId) {
      ctx.data.currentCommentId = commentId;
    }

    // Textarea should be cleared on success
    await expect(textarea).toHaveValue('', { timeout: 5_000 });

    return { entity: { comment: EntityStates.COMMENT_PENDING } };
  },

  async comment_denied(ctx, fromState) {
    // Ensure we are on a blog post page as anonymous
    if (fromState.page !== PageStates.BLOG_POST) {
      if (ctx.data.currentPostSlug) {
        await ctx.page.goto(`/blog/${ctx.data.currentPostSlug}`);
        await expect(ctx.page.getByTestId('post-title')).toBeVisible({ timeout: 10_000 });
      }
    }

    // The login link should be visible instead of comment form
    const loginLink = ctx.page.getByTestId('comment-login-link');
    await expect(loginLink).toBeVisible({ timeout: 10_000 });

    return {};
  },

  async load_more_comments(ctx) {
    // If a load-more button exists, click it
    const loadMoreBtn = ctx.page.locator(
      'button:has-text("Load More"), button:has-text("load more"), [data-testid="load-more-comments-btn"]',
    );
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      await ctx.page.waitForTimeout(500);
    }
    return {};
  },

  async approve_comment(ctx) {
    const commentId = ctx.data.currentCommentId;
    if (!commentId) return {};

    // Navigate to admin comments if not already there
    await ctx.page.goto('/admin/comments');
    await expect(ctx.page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

    const approveBtn = ctx.page.getByTestId(`approve-comment-btn-${commentId}`);
    if (await approveBtn.isVisible()) {
      const [approveRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'PUT',
        ),
        approveBtn.click(),
      ]);
      expect(approveRes.status()).toBeLessThan(300);
      await expect(ctx.page.getByTestId(`comment-status-${commentId}`)).toContainText(/Approved/i, {
        timeout: 10_000,
      });
    }

    return { entity: { comment: EntityStates.COMMENT_APPROVED } };
  },

  async reject_comment(ctx) {
    const commentId = ctx.data.currentCommentId;
    if (!commentId) return {};

    // Navigate to admin comments if not already there
    await ctx.page.goto('/admin/comments');
    await expect(ctx.page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

    const rejectBtn = ctx.page.getByTestId(`reject-comment-btn-${commentId}`);
    if (await rejectBtn.isVisible()) {
      const [rejectRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'PUT',
        ),
        rejectBtn.click(),
      ]);
      expect(rejectRes.status()).toBeLessThan(300);
      await expect(ctx.page.getByTestId(`comment-status-${commentId}`)).toContainText(/Rejected/i, {
        timeout: 10_000,
      });
    }

    return { entity: { comment: EntityStates.COMMENT_REJECTED } };
  },

  async delete_comment(ctx) {
    const commentId = ctx.data.currentCommentId;
    if (!commentId) return {};

    // Navigate to admin comments if not already there
    await ctx.page.goto('/admin/comments');
    await expect(ctx.page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

    const deleteBtn = ctx.page.getByTestId(`delete-comment-btn-${commentId}`);
    if (await deleteBtn.isVisible()) {
      ctx.page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'DELETE',
        ),
        deleteBtn.click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
      await expect(ctx.page.getByTestId(`comment-row-${commentId}`)).not.toBeVisible({ timeout: 10_000 });
    }

    ctx.data.currentCommentId = undefined;
    return { entity: { comment: EntityStates.COMMENT_NONE } };
  },

  // --- Posts (admin) --------------------------------------------------------

  async create_post(ctx) {
    // Navigate to new post page
    await ctx.page.goto('/admin/posts/new');
    await expect(ctx.page.getByTestId('post-title-input')).toBeVisible({ timeout: 10_000 });

    const title = `MBT Post ${uid()}`;
    const slug = `mbt-post-${uid()}`;
    const content = `MBT test content ${uid()}`;
    const summary = `MBT summary ${uid()}`;

    await ctx.page.getByTestId('post-title-input').fill(title);
    // Wait for auto-slug generation
    await expect(ctx.page.getByTestId('post-slug-input')).not.toHaveValue('', { timeout: 10_000 });
    await ctx.page.getByTestId('post-content-input').fill(content);
    await ctx.page.getByTestId('post-summary-input').fill(summary);

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes('/api/admin/posts') && r.request().method() === 'POST',
      ),
      ctx.page.getByTestId('post-save-btn').click(),
    ]);
    expect(saveRes.status()).toBe(201);

    const body = await saveRes.json();
    const postId = body.post?.id || body.id;
    const postSlug = body.post?.slug || body.slug || slug;
    if (postId) ctx.data.currentPostId = postId;
    if (postSlug) ctx.data.currentPostSlug = postSlug;

    return {
      page: PageStates.ADMIN_POST_EDITOR,
      entity: { post: EntityStates.POST_DRAFT },
    };
  },

  async update_post(ctx) {
    const postId = ctx.data.currentPostId;
    if (!postId) return {};

    // Navigate to the post editor
    await ctx.page.goto(`/admin/posts/${postId}`);
    await expect(ctx.page.getByTestId('post-title-input')).toBeVisible({ timeout: 10_000 });

    await ctx.page.getByTestId('post-title-input').fill(`MBT Updated ${uid()}`);

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes(`/api/admin/posts/${postId}`) && r.request().method() === 'PUT',
      ),
      ctx.page.getByTestId('post-save-btn').click(),
    ]);
    expect(saveRes.status()).toBeLessThan(300);

    return { page: PageStates.ADMIN_POST_EDITOR };
  },

  async delete_post(ctx) {
    const postId = ctx.data.currentPostId;
    if (!postId) return {};

    // Navigate to admin posts list
    await ctx.page.goto('/admin/posts');
    await expect(ctx.page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });

    const deleteBtn = ctx.page.getByTestId(`delete-post-btn-${postId}`);
    if (await deleteBtn.isVisible()) {
      ctx.page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/posts/${postId}`) && r.request().method() === 'DELETE',
        ),
        deleteBtn.click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
    }

    ctx.data.currentPostId = undefined;
    ctx.data.currentPostSlug = undefined;

    return { page: PageStates.ADMIN_POSTS };
  },

  async publish_post(ctx) {
    const postId = ctx.data.currentPostId;
    if (!postId) return {};

    // Navigate to the post editor
    await ctx.page.goto(`/admin/posts/${postId}`);
    await expect(ctx.page.getByTestId('post-title-input')).toBeVisible({ timeout: 10_000 });
    await expect(ctx.page.getByTestId('post-status-select')).toBeVisible({ timeout: 10_000 });

    await ctx.page.getByTestId('post-status-select').selectOption('published');
    await expect(ctx.page.getByTestId('post-status-select')).toHaveValue('published');

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes(`/api/admin/posts/${postId}`) && r.request().method() === 'PUT',
      ),
      ctx.page.getByTestId('post-save-btn').click(),
    ]);
    expect(saveRes.status()).toBeLessThan(300);

    return { entity: { post: EntityStates.POST_PUBLISHED } };
  },

  // --- Projects (admin) -----------------------------------------------------

  async create_project(ctx) {
    // Navigate to new project page
    await ctx.page.goto('/admin/projects/new');
    await expect(ctx.page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });

    await ctx.page.getByTestId('project-title-input').fill(`MBT Project ${uid()}`);
    await ctx.page.getByTestId('project-description-input').fill(`MBT project description ${uid()}`);
    await ctx.page.getByTestId('project-tech-stack-input').fill('Go, React');
    await ctx.page.getByTestId('project-status-select').selectOption('planning');

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST',
      ),
      ctx.page.getByTestId('project-save-btn').click(),
    ]);
    expect(saveRes.status()).toBe(201);

    const body = await saveRes.json();
    const projectId = body.project?.id || body.id;
    if (projectId) ctx.data.currentProjectId = projectId;

    return {
      page: PageStates.ADMIN_PROJECT_EDITOR,
      entity: { project: EntityStates.PROJECT_PLANNING },
    };
  },

  async update_project(ctx) {
    const projectId = ctx.data.currentProjectId;
    if (!projectId) return {};

    // Navigate to project editor
    await ctx.page.goto(`/admin/projects/${projectId}`);
    await expect(ctx.page.getByTestId('project-title-input')).toBeVisible({ timeout: 10_000 });

    await ctx.page.getByTestId('project-title-input').fill(`MBT Updated Project ${uid()}`);

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes(`/api/admin/projects/${projectId}`) && r.request().method() === 'PUT',
      ),
      ctx.page.getByTestId('project-save-btn').click(),
    ]);
    expect(saveRes.status()).toBeLessThan(300);

    return { page: PageStates.ADMIN_PROJECT_EDITOR };
  },

  async delete_project(ctx) {
    const projectId = ctx.data.currentProjectId;
    if (!projectId) return {};

    // Navigate to admin projects list
    await ctx.page.goto('/admin/projects');
    await expect(ctx.page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });

    const deleteBtn = ctx.page.getByTestId(`delete-project-btn-${projectId}`);
    if (await deleteBtn.isVisible()) {
      ctx.page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/projects/${projectId}`) && r.request().method() === 'DELETE',
        ),
        deleteBtn.click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
    }

    ctx.data.currentProjectId = undefined;

    return { page: PageStates.ADMIN_PROJECTS };
  },

  // --- Resume (admin) -------------------------------------------------------

  async add_resume_item(ctx) {
    // Navigate to admin resume page
    await ctx.page.goto('/admin/resume');
    await expect(ctx.page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

    // Fill new item form
    await ctx.page.getByTestId('resume-type-select').selectOption('work');
    await ctx.page.getByTestId('resume-title-input').fill(`MBT Resume ${uid()}`);
    await ctx.page.getByTestId('resume-company-input').fill('MBT Corp');
    await ctx.page.getByTestId('resume-location-input').fill('Test City');
    await ctx.page.getByTestId('resume-start-date-input').fill('2024-01-01');
    await ctx.page.getByTestId('resume-end-date-input').fill('2025-01-01');
    await ctx.page.getByTestId('resume-description-input').fill('MBT resume item description');

    const [saveRes] = await Promise.all([
      ctx.page.waitForResponse(
        (r) => r.url().includes('/api/admin/resume') && r.request().method() === 'POST',
      ),
      ctx.page.getByTestId('resume-save-btn').click(),
    ]);
    expect([200, 201]).toContain(saveRes.status());

    const body = await saveRes.json();
    const resumeId = body.resume?.id || body.id;
    if (resumeId) ctx.data.currentResumeId = resumeId;

    return { page: PageStates.ADMIN_RESUME };
  },

  async update_resume_item(ctx) {
    const resumeId = ctx.data.currentResumeId;
    if (!resumeId) return {};

    // Navigate to admin resume page
    await ctx.page.goto('/admin/resume');
    await expect(ctx.page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

    const editBtn = ctx.page.getByTestId(`edit-resume-btn-${resumeId}`);
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(ctx.page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });

      await ctx.page.getByTestId('resume-title-input').fill(`MBT Updated Resume ${uid()}`);

      const [saveRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST'),
        ),
        ctx.page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBeLessThan(300);
    }

    return { page: PageStates.ADMIN_RESUME };
  },

  async delete_resume_item(ctx) {
    const resumeId = ctx.data.currentResumeId;
    if (!resumeId) return {};

    // Navigate to admin resume page
    await ctx.page.goto('/admin/resume');
    await expect(ctx.page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

    const deleteBtn = ctx.page.getByTestId(`delete-resume-btn-${resumeId}`);
    if (await deleteBtn.isVisible()) {
      ctx.page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        ctx.page.waitForResponse(
          (r) => r.url().includes(`/api/admin/resume/${resumeId}`) && r.request().method() === 'DELETE',
        ),
        deleteBtn.click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
    }

    ctx.data.currentResumeId = undefined;

    return { page: PageStates.ADMIN_RESUME };
  },

  // --- Error states ---------------------------------------------------------

  async '403_error'(ctx) {
    // Attempt to access admin as non-admin (user or anonymous)
    await ctx.page.goto('/admin');

    // Expect a redirect away from /admin (to / or /login)
    await ctx.page.waitForTimeout(2000);
    const url = ctx.page.url();
    // Should no longer be on /admin
    expect(url).not.toMatch(/\/admin$/);

    return {};
  },

  async '404_error'(ctx) {
    // Navigate to a non-existent page
    await ctx.page.goto('/this-page-does-not-exist-at-all');

    // Wait for page to settle — may show a 404 page or redirect home
    await ctx.page.waitForTimeout(2000);

    return {};
  },

  // --- Reload ---------------------------------------------------------------

  async reload(ctx) {
    await ctx.page.reload();
    await expect(ctx.page.locator('header')).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Header might not be present on error pages; that is acceptable
    });

    return {};
  },
};

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export const transitionAdapters: Record<TransitionType, TransitionAdapter> = adapters;
