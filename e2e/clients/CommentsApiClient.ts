import { request } from '@playwright/test';

export class CommentsApiClient {
  private baseUrl = process.env.E2E_BASE_URL || 'http://localhost';

  private async roleContext(role: 'admin' | 'user') {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const loginRes = await ctx.post('/api/auth/test-login', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ role }),
    });
    const loginBody = await loginRes.json();
    const csrf = loginBody.csrf_token || '';
    return { ctx, csrf };
  }

  async createAsUser(data: { content: string; post_id: number; parent_id?: number }) {
    const { ctx, csrf } = await this.roleContext('user');
    const res = await ctx.post('/api/comments', { data, headers: { 'X-CSRF-Token': csrf } });
    const body = await res.json();
    await ctx.dispose();
    return body;
  }

  async getByPostSlug(slug: string) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.get(`/api/posts/${slug}/comments`);
    const body = await res.json();
    await ctx.dispose();
    return body;
  }

  async approveAsAdmin(commentId: number) {
    const { ctx, csrf } = await this.roleContext('admin');
    const res = await ctx.put(`/api/admin/comments/${commentId}/status`, {
      data: { status: 'approved' }, headers: { 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    await ctx.dispose();
    return body;
  }

  async deleteAsAdmin(commentId: number) {
    const { ctx, csrf } = await this.roleContext('admin');
    await ctx.delete(`/api/admin/comments/${commentId}`, { headers: { 'X-CSRF-Token': csrf } });
    await ctx.dispose();
  }
}
