import { request as apiRequest, expect } from '@playwright/test';

async function globalSetup() {
  // Bootstrap admin storage state
  const adminContext = await apiRequest.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://localhost',
  });

  const adminRes = await adminContext.post('/api/auth/test-login', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ role: 'admin' }),
  });
  expect(adminRes.ok(), `admin test-login status: ${adminRes.status()}`).toBeTruthy();
  const adminBody = await adminRes.json();
  expect(adminBody.user.role).toBe('admin');
  expect(adminBody.csrf_token).toBeDefined();
  await adminContext.storageState({ path: './storage/admin.storageState.json' });
  await adminContext.dispose();

  // Bootstrap user storage state
  const userContext = await apiRequest.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://localhost',
  });

  const userRes = await userContext.post('/api/auth/test-login', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ role: 'user' }),
  });
  expect(userRes.ok(), `user test-login status: ${userRes.status()}`).toBeTruthy();
  const userBody = await userRes.json();
  expect(userBody.user.role).toBe('user');
  expect(userBody.csrf_token).toBeDefined();
  await userContext.storageState({ path: './storage/user.storageState.json' });
  await userContext.dispose();
}

export default globalSetup;
