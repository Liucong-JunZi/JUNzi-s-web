import { test, expect } from '@playwright/test';
import { AdminCommentsPage } from '../../pages/admin/AdminCommentsPage';
import { CommentsApiClient } from '../../clients/CommentsApiClient';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { CommentFactory } from '../../factories/CommentFactory';
import { cleanupPosts } from '../../helpers/cleanup';

test.describe('Comment moderation', () => {
  const commentsApi = new CommentsApiClient();
  const postsApi = new PostsApiClient();
  let post: any;
  const ids: number[] = [];

  test.beforeAll(async () => {
    const data = PostFactory.create({ status: 'published' });
    post = await postsApi.create(data);
    ids.push(post.id);
  });
  test.afterAll(async () => { await cleanupPosts(ids); });

  test('TC-006: comment create, approve, visible publicly @p1', async ({ page }) => {
    const commentData = CommentFactory.create(post.id);
    const created = await commentsApi.createAsUser(commentData);
    const commentId = created.comment?.id || created.id;

    // Pending comments not visible publicly
    const pub = await commentsApi.getByPostSlug(post.slug);
    expect((pub.comments || []).find((c: any) => c.id === commentId)).toBeUndefined();

    // Admin approves
    const adminPage = new AdminCommentsPage(page);
    await adminPage.goto();
    await adminPage.approveComment(commentId);

    // Now visible
    const updated = await commentsApi.getByPostSlug(post.slug);
    expect((updated.comments || []).find((c: any) => c.id === commentId)).toBeDefined();
  });
});
