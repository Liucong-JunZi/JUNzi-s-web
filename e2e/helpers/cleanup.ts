import { PostsApiClient } from '../clients/PostsApiClient';
import { CommentsApiClient } from '../clients/CommentsApiClient';

export async function cleanupPosts(ids: number[]) {
  const api = new PostsApiClient();
  await Promise.all(ids.map(id => api.delete(id).catch(() => {})));
}

export async function cleanupComment(id: number) {
  const api = new CommentsApiClient();
  await api.deleteAsAdmin(id).catch(() => {});
}
