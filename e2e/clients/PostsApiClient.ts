import { request } from '@playwright/test';

export interface CreatePostData {
  title: string; slug: string; content: string;
  summary?: string; status?: 'draft' | 'published'; tags?: number[];
}

export class PostsApiClient {
  private baseUrl = process.env.E2E_BASE_URL || 'http://localhost';

  private async adminContext() {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const loginRes = await ctx.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role: 'admin' }),
    });
    const loginBody = await loginRes.json();
    const csrf = loginBody.csrf_token || '';
    return { ctx, csrf };
  }

  async create(data: CreatePostData) {
    const { ctx, csrf } = await this.adminContext();
    const res = await ctx.post('/api/admin/posts', { data, headers: { 'X-CSRF-Token': csrf } });
    const body = await res.json();
    await ctx.dispose();
    return body.post || body;
  }

  async delete(id: number) {
    const { ctx, csrf } = await this.adminContext();
    await ctx.delete(`/api/admin/posts/${id}`, { headers: { 'X-CSRF-Token': csrf } });
    await ctx.dispose();
  }

  async getBySlug(slug: string) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.get(`/api/posts/${slug}`);
    const body = await res.json();
    await ctx.dispose();
    return body;
  }
}
