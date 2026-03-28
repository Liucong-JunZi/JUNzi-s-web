import { type Page } from '@playwright/test';

export class PostEditorPage {
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async fillTitle(t: string) { await this.page.getByTestId('post-title-input').fill(t); }
  async fillSlug(s: string) { await this.page.getByTestId('post-slug-input').fill(s); }
  async fillContent(c: string) { await this.page.getByTestId('post-content-input').fill(c); }
  async fillSummary(s: string) { await this.page.getByTestId('post-summary-input').fill(s); }
  async selectStatus(s: string) { await this.page.getByTestId('post-status-select').selectOption(s); }
  async clickSave() { await this.page.getByTestId('post-save-btn').click(); }
}
