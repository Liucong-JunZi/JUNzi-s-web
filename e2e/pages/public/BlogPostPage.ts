import { type Page, expect } from '@playwright/test';

export class BlogPostPage {
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async goto(slug: string) {
    await this.page.goto(`/blog/${slug}`);
    await expect(this.page.getByTestId('post-title')).toBeVisible();
  }

  async submitComment(content: string) {
    await this.page.getByTestId('comment-textarea').fill(content);
    await this.page.getByTestId('comment-submit-btn').click();
  }
}
