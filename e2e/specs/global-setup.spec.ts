import { test as setup, expect } from '@playwright/test';

// Force serial execution to avoid cookie context race conditions
setup.describe.configure({ mode: 'serial' });

setup.describe('Global setup', () => {
  setup('bootstrap admin storage state', async ({ request }) => {
    const res = await request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.user.role).toBe('admin');
    expect(body.csrf_token).toBeDefined();

    await request.storageState({ path: './storage/admin.storageState.json' });
  });

  setup('bootstrap user storage state', async ({ request }) => {
    const res = await request.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'user' }),
    });
    expect(res.ok(), `test-login status: ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.user.role).toBe('user');
    expect(body.csrf_token).toBeDefined();

    await request.storageState({ path: './storage/user.storageState.json' });
  });
});
