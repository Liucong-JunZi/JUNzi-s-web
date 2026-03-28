import { test, expect } from '@playwright/test';
import { AdminPostsPage } from '../../pages/admin/AdminPostsPage';
import { PostEditorPage } from '../../pages/admin/PostEditorPage';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { cleanupPosts } from '../../helpers/cleanup';

test.describe('Admin post CRUD', () => {
  let adminPosts: AdminPostsPage;
  let editor: PostEditorPage;
  const api = new PostsApiClient();
  const ids: number[] = [];

  test.beforeEach(({ page }) => { adminPosts = new AdminPostsPage(page); editor = new PostEditorPage(page); });
  test.afterAll(async () => { await cleanupPosts(ids); });

  test('TC-004: create and publish post @p0', async ({ page }) => {
    const data = PostFactory.create({ status: 'published' });
    await adminPosts.goto();
    await adminPosts.clickNewPost();
    await editor.fillTitle(data.title);
    await editor.fillSlug(data.slug);
    await editor.fillContent(data.content);
    await editor.fillSummary(data.summary);
    await editor.selectStatus('published');

    const [res] = await Promise.all([
      page.waitForResponse('**/api/admin/posts'),
      editor.clickSave(),
    ]);
    expect(res.status()).toBe(201);
    const body = await res.json();
    const id = body.post?.id || body.id;
    if (id) ids.push(id);

    const pub = await page.context().newPage();
    await pub.goto(`/blog/${data.slug}`);
    await expect(pub.getByTestId('post-title')).toHaveText(data.title);
    await pub.close();
  });

  test('TC-005: update existing post @p1', async ({ page }) => {
    const data = PostFactory.create({ status: 'draft' });
    const post = await api.create(data);
    ids.push(post.id);

    await adminPosts.goto();
    await adminPosts.clickEditPost(post.id);

    const newTitle = `${data.title} - Updated`;
    await editor.fillTitle(newTitle);
    await editor.selectStatus('published');
    await editor.clickSave();
    await expect(page).toHaveURL(/\/admin\/posts/);

    const check = await api.getBySlug(data.slug);
    expect(check.post.title).toContain('Updated');
  });
});
