import { type Page, expect } from '@playwright/test';

export class BlogPage {
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async goto() {
    await this.page.goto('/blog');
    await expect(this.page.getByTestId('blog-page')).toBeVisible();
  }
}
