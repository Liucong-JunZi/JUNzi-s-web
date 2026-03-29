import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export type ActorRole = 'anonymous' | 'user' | 'admin';

export async function createActorContext(
  browser: Browser,
  baseURL: string,
  role: ActorRole
): Promise<BrowserContext> {
  if (role === 'anonymous') {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    return context;
  }

  const context = await browser.newContext({ baseURL });

  const loginRes = await context.request.post('/api/auth/test-login', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ role }),
  });
  expect(loginRes.ok(), `test-login(${role}) status=${loginRes.status()}`).toBeTruthy();

  const body = await loginRes.json();
  expect(body?.user?.role).toBe(role);
  expect(body?.csrf_token).toBeTruthy();
  return context;
}

export async function openPageAsActor(
  browser: Browser,
  baseURL: string,
  role: ActorRole
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await createActorContext(browser, baseURL, role);
  const page = await context.newPage();
  return { context, page };
}

export async function readCsrfToken(context: BrowserContext, baseURL: string): Promise<string> {
  const cookies = await context.cookies(baseURL);
  const token = cookies.find((c) => c.name === 'csrf_token')?.value || '';
  expect(token.length).toBeGreaterThan(0);
  return token;
}

export async function expectExternalAnchor(
  page: Page,
  locatorTestId: string,
  expectedPrefix: string
): Promise<void> {
  const anchor = page.getByTestId(locatorTestId).locator('a');
  await expect(anchor).toBeVisible();
  await expect(anchor).toHaveAttribute('href', new RegExp(`^${expectedPrefix}`));
  await expect(anchor).toHaveAttribute('target', '_blank');
}
