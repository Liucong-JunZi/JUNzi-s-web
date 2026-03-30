import { expect, type Locator, type Page } from '@playwright/test';

export interface TestContext {
  page: Page;
  actor: 'anonymous' | 'user' | 'admin';
  baseURL: string;
  data: {
    posts: number[];
    projects: number[];
    comments: number[];
    resumes: number[];
  };
}

export interface AssertionResult {
  passed: boolean;
  message?: string;
  expected?: unknown;
  actual?: unknown;
}

export const assert = {
  async visible(selector: string, timeout = 10_000): Promise<void> {
    await expect(this.locator(selector)).toBeVisible({ timeout });
  },

  async hidden(selector: string): Promise<void> {
    await expect(this.locator(selector)).not.toBeVisible();
  },

  async textContains(selector: string, text: string | RegExp): Promise<void> {
    await expect(this.locator(selector)).toContainText(text);
  },

  async textEquals(selector: string, text: string): Promise<void> {
    await expect(this.locator(selector)).toHaveText(text);
  },

  async count(selector: string, expected: number): Promise<void> {
    const actual = await this.locator(selector).count();
    expect(actual).toBe(expected);
  },

  async url(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  },

  async hasClass(selector: string, className: string): Promise<void> {
    await expect(this.locator(selector)).toHaveClass(new RegExp(className));
  },

  async notHasClass(selector: string, className: string): Promise<void> {
    await expect(this.locator(selector)).not.toHaveClass(new RegExp(className));
  },

  locator(selector: string): Locator {
    throw new Error('Must be called within a TestContext');
  },

  page: null as unknown as Page,
};

export async function assertMutation(
  page: Page,
  selector: string,
  action: () => Promise<void>,
  expectedDelta: number
): Promise<void> {
  const countBefore = await page.locator(selector).count();
  await action();
  await page.waitForTimeout(500);
  const countAfter = await page.locator(selector).count();
  expect(countAfter - countBefore).toBe(expectedDelta);
}

export async function assertApiStatus(
  response: { status: () => number },
  expected: number | number[]
): Promise<void> {
  const status = response.status();
  if (Array.isArray(expected)) {
    expect(expected).toContain(status);
  } else {
    expect(status).toBe(expected);
  }
}
