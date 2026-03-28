import { type Page, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.getByTestId('github-login-btn')).toBeVisible();
  }
}
