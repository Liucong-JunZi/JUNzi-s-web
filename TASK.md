# Task: Fix e2e/specs/like-mbt/helpers.ts

## File to modify
`e2e/specs/like-mbt/helpers.ts`

## Problems and fixes

### 1. assertLikedState — race condition (no retry)
Current: reads `textContent()` once, then sync `expect(text).toContain('Liked')` → fails if UI hasn't updated.
Fix: add `await expect(likeBtn).toContainText('Liked')` FIRST (Playwright retries), THEN read textContent for the count.

### 2. assertUnlikedState — same race condition
Fix: add `await expect(likeBtn).not.toContainText('Liked')` and `await expect(likeBtn).toContainText('Like')` FIRST.

### 3. captureLikeState — wrong parameter type
Current signature: `captureLikeState(page: Page)` — inside it does `page.getByTestId('like-btn')`.
All callers in like-mbt.spec.ts pass a Locator (the likeBtn), not a Page.
Fix: change signature to `captureLikeState(likeBtn: Locator)`, remove the getByTestId line, use `likeBtn` directly.
Remove `Page` from the import if it's no longer used.

## Target code

```typescript
export async function assertLikedState(likeBtn: Locator, expectedCount: number): Promise<void> {
  await expect(likeBtn).toContainText('Liked');   // retry-capable
  const text = await likeBtn.textContent();
  const count = parseInt(text!.match(/\d+/)![0], 10);
  expect(count).toBe(expectedCount);
  const heart = likeBtn.locator('svg');
  await expect(heart).toHaveClass(/fill-red-500/);
}

export async function assertUnlikedState(likeBtn: Locator, expectedCount: number): Promise<void> {
  await expect(likeBtn).not.toContainText('Liked');  // retry-capable
  await expect(likeBtn).toContainText('Like');
  const text = await likeBtn.textContent();
  const count = parseInt(text!.match(/\d+/)![0], 10);
  expect(count).toBe(expectedCount);
  const heart = likeBtn.locator('svg');
  await expect(heart).not.toHaveClass(/fill-red-500/);
}

export async function captureLikeState(likeBtn: Locator): Promise<{
  liked: boolean;
  count: number;
  btnText: string;
}> {
  const btnText = (await likeBtn.textContent()) ?? '';
  const count = parseInt(btnText.match(/\d+/)![0], 10);
  const liked = btnText.startsWith('Liked');
  return { liked, count, btnText };
}
```

## Rules
- Read the file first before editing
- Only modify `e2e/specs/like-mbt/helpers.ts`
- Do NOT run tests
- Use Edit tool for changes
