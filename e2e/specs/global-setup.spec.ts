import { test as setup, expect } from '@playwright/test';

// Force serial execution to avoid cookie context race conditions
setup.describe.configure({ mode: 'serial' });

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost';

setup.describe('Global setup', () => {
  setup('bootstrap admin storage state', async ({ page }) => {
    // 1. Login via API to get cookies
    const res = await page.request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const loginBody = await res.json();
    expect(loginBody.user.role).toBe('admin');

    // 2. Navigate to any page so sessionStorage is available
    await page.goto('/');
    // Wait for the page to actually load
    await page.waitForLoadState('domcontentloaded');

    // 3. Inject Zustand auth store into sessionStorage
    // This matches the structure created by Zustand's persist middleware
    await page.evaluate((user) => {
      const authData = {
        state: {
          user: user,
          isAuthenticated: true,
        },
        version: 0,
      };
      sessionStorage.setItem('auth-storage', JSON.stringify(authData));
    }, loginBody.user);

    // 4. Verify the session works by navigating to admin
    await page.goto('/admin/posts');
    // AdminRoute should NOT redirect to login - wait for admin page content
    await expect(page.getByTestId('admin-posts-page')).toBeVisible({ timeout: 15_000 });

    // 5. Save storage state (cookies + sessionStorage)
    await page.context().storageState({ path: './storage/admin.storageState.json' });
  });

  setup('bootstrap user storage state', async ({ page }) => {
    // 1. Login via API to get cookies
    const res = await page.request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'user' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const loginBody = await res.json();
    expect(loginBody.user.role).toBe('user');

    // 2. Navigate to any page so sessionStorage is available
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 3. Inject Zustand auth store into sessionStorage
    await page.evaluate((user) => {
      const authData = {
        state: {
          user: user,
          isAuthenticated: true,
        },
        version: 0,
      };
      sessionStorage.setItem('auth-storage', JSON.stringify(authData));
    }, loginBody.user);

    // 4. Save storage state (cookies + sessionStorage)
    await page.context().storageState({ path: './storage/user.storageState.json' });
  });
});
