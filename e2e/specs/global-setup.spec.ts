import { test as setup, expect } from '@playwright/test';

// Force serial execution to avoid cookie context race conditions
setup.describe.configure({ mode: 'serial' });

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost';

setup.describe('Global setup', () => {
  setup('bootstrap admin storage state', async ({ request }) => {
    const res = await request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const loginBody = await res.json();
    expect(loginBody.user.role).toBe('admin');
    expect(loginBody.csrf_token).toBeDefined();

    // Verify session is valid via /api/auth/me
    const me = await request.get('/api/auth/me');
    expect(me.ok(), `me status: ${me.status()}`).toBeTruthy();
    expect((await me.json()).user.role).toBe('admin');

    // Save cookies to storageState — admin tests will restore session
    // via the real path: cookies → /api/auth/me → Zustand store
    await request.storageState({ path: './storage/admin.storageState.json' });
  });

  setup('bootstrap user storage state', async ({ request }) => {
    const res = await request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'user' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const loginBody = await res.json();
    expect(loginBody.user.role).toBe('user');
    expect(loginBody.csrf_token).toBeDefined();

    // Verify session is valid via /api/auth/me
    const me = await request.get('/api/auth/me');
    expect(me.ok(), `me status: ${me.status()}`).toBeTruthy();
    expect((await me.json()).user.role).toBe('user');

    await request.storageState({ path: './storage/user.storageState.json' });
  });
});
