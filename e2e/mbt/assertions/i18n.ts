import { expect, type Page } from '@playwright/test';

const HARDCODED_PATTERNS = {
  en: [
    'No comments yet',
    'Be the first to comment',
    'Loading...',
    'No posts found',
    'No projects found',
    'Welcome back',
    'Page not found',
  ],
  zh: [
    '暂无评论',
    '成为第一个评论的人',
    '加载中...',
    '暂无文章',
    '暂无项目',
    '欢迎回来',
    '页面未找到',
  ],
};

export const i18nAssertions = {
  async assertI18nText(
    page: Page,
    selector: string,
    expectedKey: string,
    locale: Record<string, unknown>
  ): Promise<void> {
    const element = page.locator(selector);
    const actualText = await element.textContent();
    const expectedText = getNestedValue(locale, expectedKey);

    expect(actualText?.trim()).toBe(expectedText?.trim());
  },

  async assertNoHardcodedText(
    page: Page,
    selector: string,
    locale: 'en' | 'zh' = 'en'
  ): Promise<void> {
    const element = page.locator(selector);
    const text = await element.textContent() ?? '';

    const patterns = HARDCODED_PATTERNS[locale];
    const found = patterns.find(p => text.includes(p));

    if (found) {
      throw new Error(
        `Hardcoded text detected in ${selector}: "${found}". ` +
        `Use i18n key instead.`
      );
    }
  },

  async assertPageI18n(
    page: Page,
    contentSelectors: string[],
    locale: 'en' | 'zh' = 'en'
  ): Promise<void> {
    for (const selector of contentSelectors) {
      await i18nAssertions.assertNoHardcodedText(page, selector, locale);
    }
  },

  async scanPageForHardcodedText(
    page: Page,
    locale: 'en' | 'zh' = 'en'
  ): Promise<string[]> {
    const body = page.locator('body');
    const text = await body.textContent() ?? '';

    const patterns = HARDCODED_PATTERNS[locale];
    const found: string[] = [];

    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        found.push(pattern);
      }
    }

    return found;
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

export { getNestedValue };
