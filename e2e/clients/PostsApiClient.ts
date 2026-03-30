import { request, type APIRequestContext } from '@playwright/test';

export interface CreatePostData {
  title: string; slug: string; content: string;
  summary?: string; status?: 'draft' | 'published'; tags?: number[];
}

export class PostsApiClient {
  private baseUrl = process.env.E2E_BASE_URL || 'http://localhost';

  private async roleContext(role: 'user' | 'admin'): Promise<{ ctx: APIRequestContext; csrf: string }> {
    const ctx = await request.newContext({
      baseURL: this.baseUrl,
    });
    const loginRes = await ctx.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role }),
    });
    if (!loginRes.ok()) {
      await ctx.dispose();
      throw new Error(`test-login(${role}) failed: ${loginRes.status()}`);
    }
    const body = await loginRes.json();
    const csrf = body.csrf_token || '';
    return { ctx, csrf };
  }

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
    const res = await ctx.post('/api/admin/posts', {
      data: JSON.stringify(data),
      headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
    });
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

  async like(postId: number, role: 'user' | 'admin' = 'user'): Promise<{ liked: boolean; like_count: number }> {
    const { ctx, csrf } = await this.roleContext(role);
    try {
      const res = await ctx.post(`/api/posts/${postId}/like`, {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      if (!res.ok()) {
        throw new Error(`like(${postId}) failed: ${res.status()}`);
      }
      return await res.json();
    } finally {
      await ctx.dispose();
    }
  }

  async unlike(postId: number, role: 'user' | 'admin' = 'user'): Promise<{ liked: boolean; like_count: number }> {
    // Like is a toggle — calling again unlikes
    return this.like(postId, role);
  }
}
