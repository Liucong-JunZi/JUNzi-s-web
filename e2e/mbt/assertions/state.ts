import { expect, type Page } from '@playwright/test';

type PageGetter = () => Page;

export const stateInvariants = {
  async assertAnonymousHeader(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('login-btn')).toBeVisible();
    await expect(p.getByTestId('user-avatar')).not.toBeVisible();
    await expect(p.getByTestId('dashboard-link')).not.toBeVisible();
  },

  async assertAuthenticatedHeader(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('user-avatar')).toBeVisible();
    await expect(p.getByTestId('login-btn')).not.toBeVisible();
  },

  async assertAdminHeader(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('user-avatar')).toBeVisible();
    await expect(p.getByTestId('dashboard-link')).toBeVisible();
  },

  async assertBlogListPage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('blog-page')).toBeVisible();
    await expect(p.getByTestId('blog-search-input')).toBeVisible();
  },

  async assertBlogPostPage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('post-title')).toBeVisible();
    await expect(p.getByTestId('like-btn')).toBeVisible();
    await expect(p.getByTestId('comments-section')).toBeVisible();
  },

  async assertPortfolioListPage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('portfolio-page')).toBeVisible();
  },

  async assertAdminDashboard(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('admin-dashboard')).toBeVisible();
    await expect(p.getByTestId('create-post-action')).toBeVisible();
    await expect(p.getByTestId('manage-posts-action')).toBeVisible();
  },

  async assertAdminPostsPage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('admin-posts-page')).toBeVisible();
    await expect(p.getByTestId('new-post-btn')).toBeVisible();
  },

  async assertAdminCommentsPage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('admin-comments-page')).toBeVisible();
  },

  async assertAdminResumePage(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('admin-resume-page')).toBeVisible();
  },

  async assertLikedState(page: PageGetter): Promise<void> {
    const p = page();
    const likeBtn = p.getByTestId('like-btn');
    await expect(likeBtn).toContainText('Liked');
    const heart = likeBtn.locator('svg');
    await expect(heart).toHaveClass(/fill-red-500/);
  },

  async assertUnlikedState(page: PageGetter): Promise<void> {
    const p = page();
    const likeBtn = p.getByTestId('like-btn');
    await expect(likeBtn).toContainText('Like');
    await expect(likeBtn).not.toContainText('Liked');
    const heart = likeBtn.locator('svg');
    await expect(heart).not.toHaveClass(/fill-red-500/);
  },

  async assertCommentFormVisible(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('comment-textarea')).toBeVisible();
    await expect(p.getByTestId('comment-submit-btn')).toBeVisible();
  },

  async assertCommentFormHidden(page: PageGetter): Promise<void> {
    const p = page();
    await expect(p.getByTestId('comment-login-link')).toBeVisible();
  },
};

export const stateInvariantMap: Record<string, () => Promise<void>> = {
  'ANONYMOUS': stateInvariants.assertAnonymousHeader,
  'USER': stateInvariants.assertAuthenticatedHeader,
  'ADMIN': stateInvariants.assertAdminHeader,
  'BLOG_LIST': stateInvariants.assertBlogListPage,
  'BLOG_POST': stateInvariants.assertBlogPostPage,
  'PORTFOLIO_LIST': stateInvariants.assertPortfolioListPage,
  'ADMIN_DASHBOARD': stateInvariants.assertAdminDashboard,
  'ADMIN_POSTS': stateInvariants.assertAdminPostsPage,
  'ADMIN_COMMENTS': stateInvariants.assertAdminCommentsPage,
  'ADMIN_RESUME': stateInvariants.assertAdminResumePage,
};
