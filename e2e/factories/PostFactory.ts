export interface PostFactoryData {
  title: string; slug: string; content: string; summary: string;
  status: 'draft' | 'published'; tags?: number[];
}

export class PostFactory {
  private static counter = 0;
  static create(overrides: Partial<PostFactoryData> = {}): PostFactoryData {
    PostFactory.counter++;
    const uid = `${Date.now()}-${PostFactory.counter}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      title: `E2E Test Post ${uid}`, slug: `e2e-test-post-${uid}`,
      content: `# E2E Test\n\nAutomated content at ${new Date().toISOString()}`,
      summary: `Summary ${uid}`, status: 'draft', tags: [],
      ...overrides,
    };
  }
  static reset() { PostFactory.counter = 0; }
}
