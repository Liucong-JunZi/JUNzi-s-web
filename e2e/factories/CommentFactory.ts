export class CommentFactory {
  private static counter = 0;
  static create(postId: number, overrides: Record<string, any> = {}) {
    CommentFactory.counter++;
    return {
      content: `E2E test comment ${Date.now()}-${CommentFactory.counter}`,
      post_id: postId, ...overrides,
    };
  }
}
