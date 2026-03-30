import { expect, type Page } from '@playwright/test';

export const transitionAssertions = {
  async likeSuccess(page: Page, countBefore: number): Promise<void> {
    const likeBtn = page.getByTestId('like-btn');
    await expect(likeBtn).toContainText('Liked');
    const heart = likeBtn.locator('svg');
    await expect(heart).toHaveClass(/fill-red-500/);
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  },

  async likeDenied(page: Page, countBefore: number): Promise<void> {
    const likeBtn = page.getByTestId('like-btn');
    await expect(likeBtn).toContainText('Like');
    const heart = likeBtn.locator('svg');
    await expect(heart).not.toHaveClass(/fill-red-500/);
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  },

  async unlikeSuccess(page: Page): Promise<void> {
    const likeBtn = page.getByTestId('like-btn');
    await expect(likeBtn).toContainText('Like');
    await expect(likeBtn).not.toContainText('Liked');
    const heart = likeBtn.locator('svg');
    await expect(heart).not.toHaveClass(/fill-red-500/);
  },

  async submitCommentSuccess(page: Page): Promise<void> {
    const textarea = page.getByTestId('comment-textarea');
    await expect(textarea).toHaveValue('');
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  },

  async submitCommentDenied(page: Page): Promise<void> {
    await expect(page.getByTestId('comment-login-link')).toBeVisible();
  },

  async approveCommentSuccess(page: Page, commentId: number): Promise<void> {
    const statusEl = page.getByTestId(`comment-status-${commentId}`);
    await expect(statusEl).toContainText('Approved');
  },

  async rejectCommentSuccess(page: Page, commentId: number): Promise<void> {
    const statusEl = page.getByTestId(`comment-status-${commentId}`);
    await expect(statusEl).toContainText('Rejected');
  },

  async deleteCommentSuccess(page: Page, commentId: number): Promise<void> {
    await page.waitForTimeout(500);
    await expect(page.getByTestId(`comment-row-${commentId}`)).not.toBeVisible();
  },

  async loginSuccess(page: Page): Promise<void> {
    await expect(page.getByTestId('user-avatar')).toBeVisible();
    await expect(page.getByTestId('login-btn')).not.toBeVisible();
  },

  async logoutSuccess(page: Page, baseURL: string): Promise<void> {
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.getByTestId('login-btn')).toBeVisible();
    await expect(page.getByTestId('user-avatar')).not.toBeVisible();
  },

  async createPostSuccess(page: Page): Promise<void> {
    const url = page.url();
    expect(url.includes('/admin/posts/')).toBeTruthy();
  },

  async deletePostSuccess(page: Page, postId: number): Promise<void> {
    await page.waitForTimeout(500);
    await expect(page.getByTestId(`post-row-${postId}`)).not.toBeVisible();
  },

  async createProjectSuccess(page: Page): Promise<void> {
    const url = page.url();
    expect(url.includes('/admin/projects/')).toBeTruthy();
  },

  async deleteProjectSuccess(page: Page, projectId: number): Promise<void> {
    await page.waitForTimeout(500);
    await expect(page.getByTestId(`project-row-${projectId}`)).not.toBeVisible();
  },

  async addResumeItemSuccess(page: Page): Promise<void> {
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  },

  async deleteResumeItemSuccess(page: Page, resumeId: number): Promise<void> {
    await page.waitForTimeout(500);
    await expect(page.getByTestId(`resume-item-${resumeId}`)).not.toBeVisible();
  },

  async apiError(page: Page): Promise<void> {
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
    const errorToast = page.getByTestId('toast-error').or(page.getByTestId('error-toast'));
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  },

  async notFound(page: Page): Promise<void> {
    await expect(page).toHaveURL(/\/404|not-found/);
    await expect(page.getByTestId('not-found-page')).toBeVisible();
  },

  async forbidden(page: Page, baseURL: string): Promise<void> {
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url === `${baseURL}/` || url.includes('error')).toBeTruthy();
  },
};
