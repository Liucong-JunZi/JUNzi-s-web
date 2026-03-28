import { type Locator, type Page, expect } from '@playwright/test';

export class AdminPostsPage {
  readonly page: Page;
  readonly pageContainer: Locator;
  readonly newPostButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageContainer = page.getByTestId('admin-posts-page');
    this.newPostButton = page.getByTestId('new-post-btn');
  }

  async goto() {
    await this.page.goto('/admin/posts');
    await expect(this.pageContainer).toBeVisible();
  }

  async clickNewPost() {
    await this.newPostButton.click();
    await expect(this.page).toHaveURL(/\/admin\/posts\/new/);
  }

  async clickEditPost(postId: number) {
    await this.page.getByTestId(`edit-post-btn-${postId}`).click();
  }

  async deletePost(postId: number) {
    this.page.once('dialog', d => d.accept());
    await this.page.getByTestId(`delete-post-btn-${postId}`).click();
  }
}
