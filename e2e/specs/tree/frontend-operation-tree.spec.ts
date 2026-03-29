import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { PostFactory } from '../../factories/PostFactory';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { cleanupPosts } from '../../helpers/cleanup';

type Actor = 'anonymous' | 'user' | 'admin';

interface FlowContext {
  browser: Browser;
  baseURL: string;
  createdPostIds: number[];
}

interface OperationFlow {
  id: string;
  actor: Actor;
  title: string;
  priority: '@p0' | '@p1';
  execute: (ctx: FlowContext) => Promise<void>;
}

const STORAGE_STATE_PATH: Record<Exclude<Actor, 'anonymous'>, string> = {
  admin: './storage/admin.storageState.json',
  user: './storage/user.storageState.json',
};

async function newActorContext(browser: Browser, baseURL: string, actor: Actor): Promise<BrowserContext> {
  if (actor === 'anonymous') {
    return browser.newContext({ baseURL });
  }
  return browser.newContext({
    baseURL,
    storageState: STORAGE_STATE_PATH[actor],
  });
}

async function flowAnonymousBlockedFromAdmin(ctx: FlowContext): Promise<void> {
  const context = await newActorContext(ctx.browser, ctx.baseURL, 'anonymous');
  try {
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('github-login-btn')).toBeVisible();

    const res = await context.request.get('/api/admin/posts');
    expect([401, 403]).toContain(res.status());
  } finally {
    await context.close();
  }
}

async function flowUserBlockedFromAdmin(ctx: FlowContext): Promise<void> {
  const context = await newActorContext(ctx.browser, ctx.baseURL, 'user');
  try {
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin$/);

    const res = await context.request.get('/api/admin/posts');
    expect(res.status()).toBe(403);
  } finally {
    await context.close();
  }
}

async function flowAdminRefreshAfterAccessTokenExpired(ctx: FlowContext): Promise<void> {
  const context = await newActorContext(ctx.browser, ctx.baseURL, 'admin');
  try {
    const page = await context.newPage();
    await page.goto('/admin/posts');
    await expect(page.getByTestId('admin-posts-page')).toBeVisible();

    await context.clearCookies({ name: 'access_token' });
    await page.reload();
    await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });

    const me = await context.request.get('/api/auth/me');
    expect(me.ok()).toBeTruthy();
  } finally {
    await context.close();
  }
}

async function flowAdminLogoutInvalidatesSession(ctx: FlowContext): Promise<void> {
  const context = await newActorContext(ctx.browser, ctx.baseURL, 'admin');
  try {
    const page = await context.newPage();
    await page.goto('/admin/posts');
    await expect(page.getByTestId('admin-posts-page')).toBeVisible();

    await page.goto('/');
    await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('user-avatar').click();
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('login-btn')).toBeVisible({ timeout: 10_000 });

    const me = await context.request.get('/api/auth/me');
    expect(me.status()).toBe(401);
  } finally {
    await context.close();
  }
}

async function flowUserCreatesCommentOnPublishedPost(ctx: FlowContext): Promise<void> {
  const postsApi = new PostsApiClient();
  const postData = PostFactory.create({ status: 'published' });
  const post = await postsApi.create(postData);
  if (post.id) {
    ctx.createdPostIds.push(post.id);
  }

  const context = await newActorContext(ctx.browser, ctx.baseURL, 'user');
  try {
    const page = await context.newPage();
    await page.goto(`/blog/${post.slug}`);
    await expect(page.getByTestId('post-title')).toBeVisible();
    await expect(page.getByTestId('comment-textarea')).toBeVisible();

    const commentText = `operation-tree-comment-${Date.now()}`;
    await page.getByTestId('comment-textarea').fill(commentText);

    const [commentRes] = await Promise.all([
      page.waitForResponse((res) => {
        return res.url().includes('/api/comments') && res.request().method() === 'POST';
      }),
      page.getByTestId('comment-submit-btn').click(),
    ]);
    expect(commentRes.status()).toBe(201);
  } finally {
    await context.close();
  }
}

const FRONTEND_OPERATION_FLOWS: ReadonlyArray<OperationFlow> = [
  {
    id: 'TREE-001',
    actor: 'anonymous',
    title: 'anonymous route/api access to admin is blocked',
    priority: '@p0',
    execute: flowAnonymousBlockedFromAdmin,
  },
  {
    id: 'TREE-002',
    actor: 'user',
    title: 'regular user blocked from admin route and admin API',
    priority: '@p0',
    execute: flowUserBlockedFromAdmin,
  },
  {
    id: 'TREE-003',
    actor: 'admin',
    title: 'admin session survives access token expiry via refresh',
    priority: '@p0',
    execute: flowAdminRefreshAfterAccessTokenExpired,
  },
  {
    id: 'TREE-004',
    actor: 'admin',
    title: 'logout clears privileged session for subsequent requests',
    priority: '@p0',
    execute: flowAdminLogoutInvalidatesSession,
  },
  {
    id: 'TREE-005',
    actor: 'user',
    title: 'authenticated user can comment on a published post',
    priority: '@p1',
    execute: flowUserCreatesCommentOnPublishedPost,
  },
];

test.describe('Frontend operation tree', () => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost';
  const createdPostIds: number[] = [];

  test.afterAll(async () => {
    await cleanupPosts(createdPostIds);
  });

  for (const flow of FRONTEND_OPERATION_FLOWS) {
    test(`${flow.id}: ${flow.title} [actor=${flow.actor}] ${flow.priority}`, async ({ browser }) => {
      await flow.execute({
        browser,
        baseURL,
        createdPostIds,
      });
    });
  }
});
