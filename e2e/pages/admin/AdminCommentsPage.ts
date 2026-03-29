import { type Page, expect } from '@playwright/test';

export class AdminCommentsPage {
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async goto() {
    await this.page.goto('/admin/comments');
    await expect(this.page.getByTestId('admin-comments-page')).toBeVisible();
  }

  async approveComment(id: number) {
    const [res] = await Promise.all([
      this.page.waitForResponse(`**/api/admin/comments/${id}/status`),
      this.page.getByTestId(`approve-comment-btn-${id}`).click(),
    ]);
    expect(res.ok()).toBeTruthy();
  }

  async rejectComment(id: number) {
    await this.page.getByTestId(`reject-comment-btn-${id}`).click();
  }
}
