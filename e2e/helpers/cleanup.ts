import { chromium, type Browser, type BrowserContext } from '@playwright/test';
import { PostsApiClient } from '../clients/PostsApiClient';
import { CommentsApiClient } from '../clients/CommentsApiClient';

const baseURL = process.env.BASE_URL ?? 'http://localhost';

let sharedAdmin: { browser: Browser; context: BrowserContext; csrf: string } | null = null;

async function getAdminContext(): Promise<{ browser: Browser; context: BrowserContext; csrf: string }> {
  if (sharedAdmin) {
    return sharedAdmin;
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await context.request.post(`${baseURL}/api/auth/test-login`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ role: 'admin' }),
  });
  const cookies = await context.cookies(baseURL);
  const csrf = cookies.find((c) => c.name === 'csrf_token')?.value || '';
  sharedAdmin = { browser, context, csrf };
  return sharedAdmin;
}

export async function cleanupPosts(ids: number[]) {
  if (ids.length === 0) return;
  const api = new PostsApiClient();
  await Promise.all(ids.map(id => api.delete(id).catch(() => {})));
}

export async function cleanupComment(id: number) {
  const api = new CommentsApiClient();
  await api.deleteAsAdmin(id).catch(() => {});
}

export async function cleanupProjects(ids: number[]) {
  if (ids.length === 0) return;
  const { context, csrf } = await getAdminContext();
  await Promise.all(ids.map(id =>
    context.request
      .delete(`${baseURL}/api/admin/projects/${id}`, {
        headers: { 'X-CSRF-Token': csrf },
      })
      .catch(() => {})
  ));
}

export async function cleanupResumes(ids: number[]) {
  if (ids.length === 0) return;
  const { context, csrf } = await getAdminContext();
  await Promise.all(ids.map(id =>
    context.request
      .delete(`${baseURL}/api/admin/resume/${id}`, {
        headers: { 'X-CSRF-Token': csrf },
      })
      .catch(() => {})
  ));
}

export async function closeAdminContext() {
  if (sharedAdmin) {
    await sharedAdmin.browser.close();
    sharedAdmin = null;
  }
}
